const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const Stripe = require('stripe');
const { createBilling, settings, addMonthsClamped } = require('../server/billing.cjs');
const { rawBody } = require('../api/stripe-webhook.js');
const { validateRequest, generateWeek } = require('../api/workshop.js');
const { compose } = require('../server/planner.cjs');
const D = require('../js/data.js');
const user = { id: 'user-a', email: 'a@example.test', name: 'Camille' };
const config = { configured: true, live: false, prices: { monthly: 'price_monthly', pass: 'price_pass' }, portal: 'bpc_own' };
const now = Date.parse('2026-09-11T12:00:00Z'), created = now / 1000;
function fixture() {
  const customers = new Map(), passes = new Map(), subscriptions = new Map(), events = new Set(), locks = new Set(), sessions = new Map();
  const writes = [], calls = [], paidInvoices = [], stripeSubscriptions = [], intents = new Map(), disputes = [];
  const repo = {
    lock: async k => { if (locks.has(k)) return false; locks.add(k); return true; }, unlock: async k => locks.delete(k),
    customer: async id => customers.get(id), owner: async id => [...customers.values()].find(c => c.customer_id === id), customers: async id => [customers.get(id)].filter(Boolean),
    saveCustomer: async (id, live, customer) => { const c = { user_id: id, livemode: live, customer_id: customer }; customers.set(id, c); return c; },
    setCheckout: async (id, live, s, plan) => Object.assign(customers.get(id), { checkout_id: s.id, checkout_plan: plan }),
    closing: async id => { customers.get(id).closing = true; }, trial: async () => null,
    access: async id => { const s = [...subscriptions.values()].find(s => s.user === id && ['active', 'past_due'].includes(s.state) && Date.parse(s.until) > now), p = [...passes.values()].find(p => p.user === id && p.active && Date.parse(p.until) > now); return { active: !!(s || p), plan: s ? 'monthly' : p ? 'pass' : null, until: (s || p)?.until, cancelAtPeriodEnd: s?.cancelAtPeriodEnd }; },
    saveSubscription: async s => { writes.push(s); subscriptions.set(s.id, s); },
    savePass: async p => { writes.push(p); passes.set(p.id, passes.has(p.id) ? { ...passes.get(p.id), active: p.active } : p); },
    paymentRecords: async id => [...passes.values(), ...subscriptions.values()].filter(v => v.paymentIntent === id).map(v => ({ id: v.id, kind: passes.has(v.id) ? 'pass' : 'monthly' })),
    eventSeen: async id => events.has(id), saveEvent: async id => events.add(id)
  };
  const stripe = {
    customers: { create: async (data, opts) => { calls.push(['customer', data, opts]); return { id: 'cus_a' }; } },
    checkout: { sessions: {
      create: async (data, opts) => { calls.push(['checkout', data, opts]); const s = { ...data, id: 'cs_test_abcdefghijklm', status: 'open', livemode: false, url: 'https://checkout.stripe.com/c/pay/test_own' }; sessions.set(s.id, s); return s; },
      retrieve: async id => { assert.ok(sessions.has(id), 'known session'); return sessions.get(id); },
      expire: async id => { calls.push(['expire', id]); sessions.get(id).status = 'expired'; },
      listLineItems: async id => ({ data: sessions.get(id).testLines || [{ price: config.prices[sessions.get(id).metadata.plan], quantity: 1 }] })
    } },
    subscriptions: {
      list: async () => ({ data: stripeSubscriptions }), retrieve: async id => stripeSubscriptions.find(s => s.id === id),
      cancel: async (id, options) => { calls.push(['cancel', id, options]); stripeSubscriptions.find(s => s.id === id).status = 'canceled'; }
    },
    prices: { retrieve: async id => ({ id, active: true, livemode: false, currency: 'eur', unit_amount: id === config.prices.monthly ? 490 : 2990, recurring: id === config.prices.monthly ? { interval: 'month', interval_count: 1 } : null }) },
    paymentIntents: { retrieve: async id => intents.get(id) },
    invoices: { list: async () => ({ data: paidInvoices }), retrieve: async id => paidInvoices.find(i => i.id === id) },
    invoicePayments: { list: async () => ({ data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_monthly' } }] }) },
    disputes: { list: async () => ({ data: disputes }) },
    charges: { retrieve: async () => ({ customer: 'cus_a' }) },
    billingPortal: { sessions: { create: async data => { calls.push(['portal', data]); return { url: 'https://billing.stripe.com/p/session/own' }; } } }
  };
  const billing = createBilling({ stripe, repo, config, now: () => now });
  function intent(id = 'pi_pass', amount = 2990) { const i = { id, livemode: false, customer: 'cus_a', status: 'succeeded', amount_received: amount, latest_charge: { paid: true, created, refunded: false, disputed: false } }; intents.set(id, i); return i; }
  function pass() { customers.set(user.id, { user_id: user.id, customer_id: 'cus_a', livemode: false }); const s = { id: 'cs_test_paidabcdefghijk', customer: 'cus_a', metadata: { app: 'miamama', plan: 'pass' }, livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', payment_intent: 'pi_pass', amount_total: 2990 }; sessions.set(s.id, s); intent(); return s; }
  function monthly() { customers.set(user.id, { user_id: user.id, customer_id: 'cus_a', livemode: false }); const s = { id: 'sub_own', customer: 'cus_a', metadata: { app: 'miamama' }, livemode: false, status: 'active', items: { data: [{ price: config.prices.monthly, quantity: 1, current_period_end: created + 60 * 86400 }] } }; stripeSubscriptions.push(s); paidInvoices.push({ id: 'in_paid', customer: 'cus_a', livemode: false, status: 'paid', amount_due: 490, parent: { subscription_details: { subscription: s.id } }, lines: { data: [{ pricing: { price_details: { price: config.prices.monthly } }, period: { end: created + 30 * 86400 } }] } }); intent('pi_monthly', 490); return s; }
  return { billing, stripe, repo, customers, passes, subscriptions, events, calls, writes, sessions, stripeSubscriptions, paidInvoices, intents, locks, disputes, pass, monthly };
}
test('Billing requires a durable server key and the complete matching configuration', () => {
  const env = { STRIPE_SECRET_KEY: 'sk_live_placeholder', STRIPE_PRICE_MONTHLY: 'price_1', STRIPE_PRICE_PASS: 'price_2', STRIPE_WEBHOOK_SECRET: 'whsec_placeholder', STRIPE_PORTAL_CONFIGURATION: 'bpc_1' };
  assert.equal(settings(env).configured, true); assert.equal(settings(env).live, true);
  for (const key of Object.keys(env)) assert.equal(settings({ ...env, [key]: '' }).configured, false);
  assert.equal(settings({ ...env, STRIPE_SECRET_KEY: 'uat_placeholder' }).configured, false);
});
test('The pass lasts nine calendar months, including short months and leap years', () => {
  assert.equal(addMonthsClamped(Date.parse('2026-05-31T13:15:00Z') / 1000, 9), '2027-02-28T13:15:00.000Z');
  assert.equal(addMonthsClamped(Date.parse('2027-05-31T13:15:00Z') / 1000, 9), '2028-02-29T13:15:00.000Z');
});
test('Checkout accepts only server plans, trusted account ownership and exact EUR prices', async () => {
  const f = fixture(); await assert.rejects(f.billing.checkout(user, 'free', 'https://app.test'), { status: 400 });
  await f.billing.checkout(user, 'monthly', 'https://app.test');
  const [, request, options] = f.calls.find(c => c[0] === 'checkout');
  assert.deepEqual(request.line_items, [{ price: 'price_monthly', quantity: 1 }]); assert.equal(request.customer, 'cus_a');
  assert.equal(request.subscription_data.metadata.user_id, user.id); assert.equal(request.mode, 'subscription');
  assert.equal(request.success_url, 'https://app.test/?checkout=success&session_id={CHECKOUT_SESSION_ID}#plus'); assert.ok(options.idempotencyKey);
  const bad = fixture(); bad.stripe.prices.retrieve = async () => ({ active: true, livemode: false, currency: 'usd', unit_amount: 2990 });
  await assert.rejects(bad.billing.checkout(user, 'pass', 'https://app.test'), { status: 503 }); assert.equal(bad.calls.filter(c => c[0] === 'checkout').length, 0);
});
test('Repeated checkout clicks reuse an open session, and a different plan expires it', async () => {
  const f = fixture(); const a = await f.billing.checkout(user, 'pass', 'https://app.test'); const b = await f.billing.checkout(user, 'pass', 'https://app.test');
  assert.deepEqual(a, b); assert.equal(f.calls.filter(c => c[0] === 'checkout').length, 1);
  await f.billing.checkout(user, 'monthly', 'https://app.test'); assert.equal(f.calls.filter(c => c[0] === 'expire').length, 1);
  f.locks.add('checkout:false:user-a'); await assert.rejects(f.billing.checkout(user, 'pass', 'https://app.test'), { status: 409 });
});
test('An existing subscription or already-paid pass cannot accidentally start another charge', async () => {
  const f = fixture(); f.monthly(); await assert.rejects(f.billing.checkout(user, 'monthly', 'https://app.test'), { status: 409 });
  const g = fixture(), s = g.pass(); g.customers.get(user.id).checkout_id = s.id;
  await assert.rejects(g.billing.checkout(user, 'pass', 'https://app.test'), { status: 409 }); assert.equal((await g.repo.access(user.id)).active, true);
  assert.equal(g.calls.filter(c => c[0] === 'checkout').length, 0);
});
test('A checkout return is never proof of payment and cannot claim another customer’s purchase', async () => {
  const f = fixture(), s = f.pass(); s.payment_status = 'unpaid';
  assert.equal((await f.billing.confirm(user, s.id)).access.active, false);
  s.payment_status = 'paid'; f.customers.set('user-b', { user_id: 'user-b', customer_id: 'cus_b' });
  await assert.rejects(f.billing.confirm({ id: 'user-b' }, s.id), { status: 403 });
  s.testLines = [{ price: 'price_other', quantity: 1 }]; assert.equal((await f.billing.confirm(user, s.id)).access.active, false);
  delete s.testLines; assert.equal((await f.billing.confirm(user, s.id)).access.active, true);
});
test('Pass fulfillment is idempotent, isolates Stripe mode and revokes full refunds', async () => {
  const f = fixture(), s = f.pass(); const event = { id: 'evt_1', livemode: false, type: 'checkout.session.completed', data: { object: s } };
  assert.deepEqual(await f.billing.webhook({ ...event, livemode: true }), { ignored: true });
  await f.billing.webhook(event); const until = f.passes.get(s.id).until;
  assert.deepEqual(await f.billing.webhook(event), { duplicate: true });
  await f.billing.webhook({ ...event, id: 'evt_2' }); assert.equal(f.passes.get(s.id).until, until);
  f.intents.get('pi_pass').latest_charge.refunded = true;
  await f.billing.webhook({ id: 'evt_refund', livemode: false, type: 'charge.refunded', data: { object: { customer: 'cus_a', payment_intent: 'pi_pass' } } });
  assert.equal((await f.repo.access(user.id)).active, false);
});
test('Monthly access follows the paid invoice, never an unpaid future renewal date', async () => {
  const f = fixture(), s = f.monthly(); await f.billing.syncSubscription(s.id);
  assert.equal(f.subscriptions.get(s.id).until, new Date((created + 30 * 86400) * 1000).toISOString());
  s.status = 'past_due'; await f.billing.syncSubscription(s.id); assert.equal((await f.repo.access(user.id)).active, true);
  f.paidInvoices[0].lines.data[0].period.end = created - 1; await f.billing.syncSubscription(s.id); assert.equal((await f.repo.access(user.id)).active, false);
  f.paidInvoices[0].lines.data[0].period.end = created + 30 * 86400; s.cancel_at_period_end = true; s.status = 'active'; await f.billing.syncSubscription(s.id);
  assert.equal((await f.repo.access(user.id)).active, true); assert.equal((await f.repo.access(user.id)).cancelAtPeriodEnd, true);
  s.status = 'canceled'; await f.billing.syncSubscription(s.id); assert.equal((await f.repo.access(user.id)).active, false);
});
test('Late subscription events use canonical Stripe state and a refunded invoice loses access', async () => {
  const f = fixture(), s = f.monthly(); await f.billing.syncSubscription(s.id);
  f.intents.get('pi_monthly').latest_charge.refunded = true;
  await f.billing.webhook({ id: 'evt_refund', livemode: false, type: 'charge.refunded', data: { object: { customer: 'cus_a', payment_intent: 'pi_monthly' } } });
  assert.equal((await f.repo.access(user.id)).active, false);
  s.status = 'canceled'; await f.billing.webhook({ id: 'evt_old', livemode: false, type: 'customer.subscription.updated', data: { object: { id: s.id, customer: 'cus_a', status: 'active' } } });
  assert.equal(f.subscriptions.get(s.id).state, 'canceled');
});
test('Disputed payments pause access, and a won dispute restores the original pass', async () => {
  const f = fixture(), s = f.pass(); await f.billing.syncSession(s.id); const until = f.passes.get(s.id).until;
  f.intents.get('pi_pass').latest_charge.disputed = true; f.disputes.push({ status: 'needs_response' });
  const event = { id: 'evt_dispute', livemode: false, type: 'charge.dispute.created', data: { object: { charge: 'ch_pass', payment_intent: 'pi_pass' } } };
  await f.billing.webhook(event); assert.equal((await f.repo.access(user.id)).active, false);
  f.disputes[0].status = 'won'; await f.billing.webhook({ ...event, id: 'evt_won', type: 'charge.dispute.closed' });
  assert.equal((await f.repo.access(user.id)).active, true); assert.equal(f.passes.get(s.id).until, until);
});
test('Failed event processing is retriable; portal and account deletion stay scoped to the owner', async () => {
  const f = fixture(), s = f.monthly(); f.stripeSubscriptions.push({ ...s, id: 'sub_unrelated', metadata: { app: 'other' } });
  f.stripe.subscriptions.retrieve = async () => { throw new Error('temporary network'); };
  await assert.rejects(f.billing.webhook({ id: 'evt_retry', livemode: false, type: 'customer.subscription.updated', data: { object: s } })); assert.equal(f.events.has('evt_retry'), false); assert.equal(f.locks.size, 0);
  await f.billing.portal(user, 'https://app.test'); assert.deepEqual(f.calls.find(c => c[0] === 'portal')[1], { customer: 'cus_a', configuration: 'bpc_own', return_url: 'https://app.test/?billing=updated#plus' });
  await f.billing.closeAccount(user); assert.equal(f.customers.get(user.id).closing, true); assert.deepEqual(f.calls.filter(c => c[0] === 'cancel').map(c => c[1]), ['sub_own']);
});
test('Webhook validation uses the untouched bytes and rejects altered, parsed or oversized bodies', async () => {
  const secret = 'whsec_unit_test_only', payload = JSON.stringify({ id: 'evt_local', type: 'invoice.paid', data: { object: {} } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const body = await rawBody(Readable.from([payload.slice(0, 10), payload.slice(10)]));
  assert.equal(Stripe.webhooks.constructEvent(body, signature, secret).id, 'evt_local');
  assert.throws(() => Stripe.webhooks.constructEvent(Buffer.from(payload + ' '), signature, secret));
  await assert.rejects(rawBody({ body: JSON.parse(payload) }), { status: 400 });
  await assert.rejects(rawBody({ body: 'too large' }, 3), { status: 413 });
});
test('The Vercel Web Handler preserves JSON whitespace for signature verification', async () => {
  const webhook = require('../api/stripe-webhook.js'); const old = process.env.STRIPE_WEBHOOK_SECRET;
  const oldKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_web_handler'; delete process.env.STRIPE_SECRET_KEY;
  const payload = '{ "id": "evt_web",\n "type": "invoice.paid", "data": {"object":{}} }';
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  try {
    const valid = await webhook.fetch(new Request('https://app.test/api/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload }));
    assert.equal(valid.status, 503); assert.match((await valid.json()).error, /configuration/);
    const invalid = await webhook.fetch(new Request('https://app.test/api/stripe-webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: JSON.stringify(JSON.parse(payload)) }));
    assert.equal(invalid.status, 400); assert.equal(invalid.headers.get('cache-control'), 'no-store');
  } finally { if (old === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = old; if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = oldKey; }
});
test('The server validates real weeks, refuses hostile drafts and keeps date changes explicit', () => {
  const options = { start: '2026-09-14', meals: 'dinner', maxTime: 45 }, entries = compose(D.recipes, options);
  assert.equal(validateRequest({ action: 'compose', options, entries }, now).entries.length, 7);
  assert.throws(() => validateRequest({ action: 'compose', options: { ...options, start: '2026-09-15' } }, now), { status: 400 });
  assert.throws(() => validateRequest({ action: 'swap', options: { ...options, start: '2026-09-21' }, entries, index: 0 }, now), { status: 400 });
  assert.throws(() => validateRequest({ action: 'swap', options, entries, index: -1 }, now), { status: 400 });
  assert.throws(() => validateRequest({ action: 'compose', options, entries: [{ date: '2026-09-14', recipe: '__proto__' }] }, now), { status: 400 });
});
test('The first complete week is free; subsequent weeks are gated on the server even with a forged local Plus flag', async () => {
  const trials = new Map(); let active = false;
  const repo = { access: async () => ({ active }), trial: async id => trials.get(id), claimTrial: async (id, start) => { if (trials.has(id)) return trials.get(id) === start; trials.set(id, start); return true; } };
  const body = date => validateRequest({ action: 'compose', options: { start: date, meals: 'both', maxTime: 45 }, premium: true }, now);
  await assert.rejects(generateWeek(body('2026-09-14'), { config, user: null, repo }), { status: 401 });
  const concurrent = await Promise.allSettled(['2026-09-14', '2026-09-21'].map(d => generateWeek(body(d), { config, user, repo })));
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(concurrent.find(r => r.status === 'rejected').reason.status, 402);
  assert.equal((await generateWeek(body(trials.get(user.id)), { config, user, repo })).entries.length, 14);
  active = true; assert.equal((await generateWeek(body('2026-09-28'), { config, user, repo })).entries.length, 14);
  active = false; await assert.rejects(generateWeek(body('2026-09-28'), { config, user, repo }), { status: 402 });
});
