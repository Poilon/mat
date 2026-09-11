'use strict';
const Stripe = require('stripe');
const { randomUUID, createHash } = require('node:crypto');
const { HttpError } = require('./http.cjs');
const { billingStore } = require('./billing-store.cjs');
const { offer } = require('../js/plus.js');
const idOf = value => typeof value === 'string' ? value : value?.id || null;
const dateOf = seconds => Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
function settings(env = process.env) {
  const secret = env.STRIPE_SECRET_KEY || '';
  const configured = /^(sk|rk)_(live|test)_/.test(secret) && Boolean(env.STRIPE_PRICE_MONTHLY && env.STRIPE_PRICE_PASS && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PORTAL_CONFIGURATION);
  return { configured, live: /^(sk|rk)_live_/.test(secret), secret, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    prices: { monthly: env.STRIPE_PRICE_MONTHLY, pass: env.STRIPE_PRICE_PASS }, portal: env.STRIPE_PORTAL_CONFIGURATION };
}
function addMonthsClamped(seconds, months) {
  const date = new Date(seconds * 1000), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return date.toISOString();
}
function publicPlans() { return offer.plans.map(({ id, name, cents, months, recurring, cadence, terms }) => ({ id, name, cents, months, recurring, cadence, terms })); }
function createBilling({ stripe, repo, config, now = () => Date.now() }) {
  function requireConfigured() { if (!config.configured) throw new HttpError(503, 'Les paiements ne sont pas encore ouverts. Votre carnet reste accessible.'); }
  async function locked(key, fn) {
    const token = randomUUID();
    if (!await repo.lock(key, token)) throw new HttpError(409, 'Une opération est déjà en cours. Réessayez dans quelques instants.');
    try { return await fn(); } finally { await repo.unlock(key, token); }
  }
  function mine(subscription) {
    return subscription?.metadata?.app === 'miamama' && subscription.livemode === config.live && subscription.items?.data?.some(i => idOf(i.price) === config.prices.monthly && i.quantity === 1);
  }
  async function paidIntent(id) {
    if (!id) return { paid: false, created: 0 };
    const intent = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] });
    const charge = intent.latest_charge;
    let disputed = Boolean(charge?.disputed);
    if (disputed) { const disputes = await stripe.disputes.list({ payment_intent: id, limit: 10 }); disputed = !disputes.data.length || disputes.data.some(d => !['won', 'warning_closed'].includes(d.status)); }
    return { paid: intent.livemode === config.live && intent.status === 'succeeded' && Boolean(charge?.paid) && !charge.refunded && !disputed,
      created: charge?.created || intent.created, amount: intent.amount_received, customer: idOf(intent.customer) };
  }
  async function syncSubscription(id) {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (!mine(subscription)) return;
    const customer = idOf(subscription.customer), owner = await repo.owner(customer, config.live);
    if (!owner || owner.closing) return;
    let until = null, paymentIntent = null;
    if (['active', 'past_due'].includes(subscription.status)) {
      // The paid invoice, rather than the next billing date, controls access during retries.
      const invoices = await stripe.invoices.list({ subscription: id, status: 'paid', limit: 1 });
      const invoice = invoices.data[0];
      if (invoice && idOf(invoice.customer) === customer && invoice.livemode === config.live) {
        const lines = invoice.lines.data.filter(line => idOf(line.pricing?.price_details?.price || line.price) === config.prices.monthly);
        const end = Math.max(0, ...lines.map(line => line.period?.end || 0));
        const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: 'paid', limit: 10 });
        paymentIntent = idOf(payments.data.find(p => p.payment?.type === 'payment_intent')?.payment.payment_intent);
        const payment = await paidIntent(paymentIntent);
        if ((payment.paid && payment.customer === customer) || (invoice.amount_due === 0 && invoice.status === 'paid')) until = dateOf(end);
      }
    }
    await repo.saveSubscription({ id, user: owner.user_id, live: config.live, customer, state: subscription.status, until,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || subscription.cancel_at), paymentIntent });
  }
  async function syncSession(id, expectedUser) {
    const session = await stripe.checkout.sessions.retrieve(id);
    const customer = idOf(session.customer), owner = customer && await repo.owner(customer, config.live);
    if (expectedUser && owner?.user_id !== expectedUser) throw new HttpError(403, 'Ce paiement n’est pas associé à votre compte.');
    if (!owner || owner.closing || session.metadata?.app !== 'miamama' || session.livemode !== config.live) return;
    if (session.status !== 'complete' || session.payment_status !== 'paid') return;
    const lines = await stripe.checkout.sessions.listLineItems(id, { limit: 2 });
    const plan = session.metadata.plan;
    if (!['monthly', 'pass'].includes(plan) || lines.data.length !== 1 || lines.data[0].quantity !== 1 || idOf(lines.data[0].price) !== config.prices[plan]) return;
    if (session.mode === 'subscription' && plan === 'monthly' && session.subscription) return syncSubscription(idOf(session.subscription));
    if (session.mode !== 'payment' || plan !== 'pass' || !session.payment_intent) return;
    const paymentIntent = idOf(session.payment_intent), payment = await paidIntent(paymentIntent);
    if (payment.customer !== customer || !payment.created || payment.amount < session.amount_total) return;
    await repo.savePass({ id, user: owner.user_id, live: config.live, customer, paymentIntent, active: payment.paid,
      start: dateOf(payment.created), until: addMonthsClamped(payment.created, 9) });
  }
  async function status(user) {
    return { configured: config.configured, mode: config.configured ? (config.live ? 'live' : 'test') : 'unavailable', plans: publicPlans(),
      access: user ? await repo.access(user.id, config.live) : { active: false, plan: null, until: null, subscriptionStatus: null },
      trialWeek: user ? await repo.trial(user.id) : null, signedIn: Boolean(user), canManage: user ? Boolean(await repo.customer(user.id, config.live)) : false };
  }
  async function customerFor(user) {
    let row = await repo.customer(user.id, config.live);
    if (!row) {
      const hash = createHash('sha256').update(user.id).digest('hex').slice(0, 32);
      const customer = await stripe.customers.create({ email: user.email, ...(user.name ? { name: user.name } : {}), metadata: { app: 'miamama', user_id: user.id } }, { idempotencyKey: `miamama-customer-${config.live}-${hash}` });
      row = await repo.saveCustomer(user.id, config.live, customer.id);
    }
    if (row.closing) throw new HttpError(409, 'La suppression de ce compte est en cours. Terminez-la depuis votre espace.');
    return row;
  }
  async function checkout(user, plan, origin) {
    requireConfigured();
    if (!['monthly', 'pass'].includes(plan)) throw new HttpError(400, 'Choisissez une formule Miamama Plus.');
    return locked(`checkout:${config.live}:${user.id}`, async () => {
      const row = await customerFor(user);
      const access = await repo.access(user.id, config.live);
      if (access.active) throw new HttpError(409, 'Votre accès Plus est déjà actif.', { code: 'already_active' });
      const subscriptions = await stripe.subscriptions.list({ customer: row.customer_id, status: 'all', limit: 100 });
      if (subscriptions.data.some(s => mine(s) && !['canceled', 'incomplete_expired'].includes(s.status))) throw new HttpError(409, 'Un abonnement existe déjà. Retrouvez-le dans la gestion de votre abonnement.', { code: 'manage_subscription' });
      if (row.checkout_id) {
        const previous = await stripe.checkout.sessions.retrieve(row.checkout_id);
        if (previous.status === 'complete') {
          await locked(`customer:${config.live}:${row.customer_id}`, () => syncSession(previous.id, user.id));
          if ((await repo.access(user.id, config.live)).active) throw new HttpError(409, 'Votre accès Plus est déjà actif.', { code: 'already_active' });
          if (previous.payment_status !== 'paid') throw new HttpError(409, 'Votre précédent paiement est encore en cours de confirmation.');
        }
        if (previous.status === 'open' && previous.expires_at * 1000 > now()) {
          if (row.checkout_plan === plan) return { url: previous.url };
          await stripe.checkout.sessions.expire(previous.id);
        }
      }
      const price = await stripe.prices.retrieve(config.prices[plan]);
      const expected = offer.plans.find(p => p.id === plan);
      if (!price.active || price.livemode !== config.live || price.currency !== 'eur' || price.unit_amount !== expected.cents ||
          (plan === 'monthly' ? price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1 : Boolean(price.recurring))) {
        throw new HttpError(503, 'Cette formule est temporairement indisponible. Aucun paiement n’a été lancé.');
      }
      const metadata = { app: 'miamama', plan, user_id: user.id };
      const session = await stripe.checkout.sessions.create({ mode: plan === 'monthly' ? 'subscription' : 'payment', customer: row.customer_id,
        client_reference_id: user.id, metadata, line_items: [{ price: price.id, quantity: 1 }], payment_method_types: ['card'], locale: 'fr',
        success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#plus`, cancel_url: `${origin}/?checkout=cancelled#plus`,
        expires_at: Math.floor(now() / 1000) + 1800,
        ...(plan === 'monthly' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata }, invoice_creation: { enabled: true } })
      }, { idempotencyKey: `miamama-checkout-${config.live}-${user.id}-${plan}-${row.checkout_id || 'first'}-${Math.floor(now() / 1800000)}` });
      await repo.setCheckout(user.id, config.live, session, plan);
      return { url: session.url };
    });
  }
  async function portal(user, origin) {
    requireConfigured(); const row = await repo.customer(user.id, config.live);
    if (!row) throw new HttpError(404, 'Aucun achat n’est associé à ce compte.');
    const session = await stripe.billingPortal.sessions.create({ customer: row.customer_id, configuration: config.portal, return_url: `${origin}/?billing=updated#plus` });
    return { url: session.url };
  }
  async function confirm(user, session) {
    requireConfigured(); if (!/^cs_(?:test_|live_)?[a-zA-Z0-9_]{10,240}$/.test(session || '')) throw new HttpError(400, 'La référence du paiement est invalide.');
    const row = await repo.customer(user.id, config.live);
    if (!row) throw new HttpError(403, 'Ce paiement n’est pas associé à votre compte.');
    await locked(`customer:${config.live}:${row.customer_id}`, () => syncSession(session, user.id));
    return status(user);
  }
  async function webhook(event) {
    requireConfigured();
    if (event.livemode !== config.live) return { ignored: true };
    if (await repo.eventSeen(event.id, config.live)) return { duplicate: true };
    const object = event.data.object;
    let customer = idOf(object.customer);
    if (event.type.startsWith('charge.dispute.')) {
      const charge = await stripe.charges.retrieve(idOf(object.charge)); customer = idOf(charge.customer);
    }
    const owner = customer && await repo.owner(customer, config.live);
    if (!owner || owner.closing) return { ignored: true };
    await locked(`customer:${config.live}:${customer}`, async () => {
      if (await repo.eventSeen(event.id, config.live)) return;
      if (event.type.startsWith('checkout.session.')) await syncSession(object.id);
      else if (event.type.startsWith('customer.subscription.')) await syncSubscription(object.id);
      else if (event.type.startsWith('invoice.')) {
        const invoice = await stripe.invoices.retrieve(object.id);
        const subscription = idOf(invoice.parent?.subscription_details?.subscription || invoice.subscription);
        if (subscription) await syncSubscription(subscription);
      } else if (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.')) {
        const payment = idOf(object.payment_intent);
        for (const record of await repo.paymentRecords(payment, config.live)) {
          if (record.kind === 'pass') await syncSession(record.id); else await syncSubscription(record.id);
        }
      }
      await repo.saveEvent(event.id, config.live);
    });
    return { received: true };
  }
  async function refresh(user) {
    requireConfigured(); const row = await repo.customer(user.id, config.live);
    if (row && !row.closing) await locked(`customer:${config.live}:${row.customer_id}`, async () => {
      const subscriptions = await stripe.subscriptions.list({ customer: row.customer_id, status: 'all', limit: 100 });
      for (const subscription of subscriptions.data.filter(mine)) await syncSubscription(subscription.id);
      if (row.checkout_id) await syncSession(row.checkout_id, user.id);
    });
    return status(user);
  }
  async function closeAccount(user) {
    const rows = await repo.customers(user.id);
    if (!rows.length) return;
    requireConfigured();
    if (rows.some(row => row.livemode !== config.live)) throw new HttpError(409, 'Contactez le support pour clôturer les achats associés à cet autre environnement Stripe.');
    await locked(`checkout:${config.live}:${user.id}`, async () => {
      await repo.closing(user.id);
      for (const row of rows) {
        if (row.checkout_id) {
          const session = await stripe.checkout.sessions.retrieve(row.checkout_id);
          if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
        }
        const subscriptions = await stripe.subscriptions.list({ customer: row.customer_id, status: 'all', limit: 100 });
        for (const subscription of subscriptions.data.filter(mine)) if (!['canceled', 'incomplete_expired'].includes(subscription.status)) await stripe.subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false });
      }
    });
  }
  return { status, checkout, portal, confirm, webhook, closeAccount, refresh, syncSubscription, syncSession };
}
let client, lastKey;
function service() {
  const config = settings();
  if (config.configured && (!client || lastKey !== config.secret)) { client = new Stripe(config.secret, { apiVersion: '2026-08-26.dahlia', maxNetworkRetries: 1, timeout: 7000 }); lastKey = config.secret; }
  return createBilling({ stripe: client, repo: billingStore(), config });
}
module.exports = { settings, publicPlans, addMonthsClamped, createBilling, service };
