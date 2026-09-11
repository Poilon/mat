'use strict';
const { database } = require('./db.cjs');
function billingStore(sql = database()) {
  return {
    async lock(key, token) {
      const rows = await sql`INSERT INTO miette_billing_locks (key, token, expires_at) VALUES (${key}, ${token}, now() + interval '60 seconds')
        ON CONFLICT (key) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
        WHERE miette_billing_locks.expires_at < now() RETURNING key`;
      return rows.length > 0;
    },
    async unlock(key, token) { await sql`DELETE FROM miette_billing_locks WHERE key = ${key} AND token = ${token}`; },
    async customer(user, live) { return (await sql`SELECT * FROM miette_billing_customers WHERE user_id = ${user} AND livemode = ${live}`)[0]; },
    async owner(customer, live) { return (await sql`SELECT * FROM miette_billing_customers WHERE customer_id = ${customer} AND livemode = ${live}`)[0]; },
    async customers(user) { return sql`SELECT * FROM miette_billing_customers WHERE user_id = ${user}`; },
    async saveCustomer(user, live, customer) {
      const [row] = await sql`INSERT INTO miette_billing_customers (user_id, livemode, customer_id) VALUES (${user}, ${live}, ${customer})
        ON CONFLICT (user_id, livemode) DO UPDATE SET customer_id = miette_billing_customers.customer_id RETURNING *`;
      return row;
    },
    async setCheckout(user, live, session, plan) {
      await sql`UPDATE miette_billing_customers SET checkout_id = ${session.id}, checkout_plan = ${plan}, checkout_expires = to_timestamp(${session.expires_at})
        WHERE user_id = ${user} AND livemode = ${live}`;
    },
    async closing(user) { await sql`UPDATE miette_billing_customers SET closing = true WHERE user_id = ${user}`; },
    async access(user, live) {
      const [row] = await sql`SELECT kind, access_until, cancel_at_period_end, state FROM (
        SELECT 'monthly' AS kind, access_until, cancel_at_period_end, state FROM miette_subscriptions
          WHERE user_id = ${user} AND livemode = ${live} AND state IN ('active', 'past_due') AND access_until > now()
        UNION ALL SELECT 'pass' AS kind, access_until, false AS cancel_at_period_end, 'active' AS state FROM miette_passes
          WHERE user_id = ${user} AND livemode = ${live} AND active = true AND access_until > now()
        ) AS entitlements ORDER BY access_until DESC LIMIT 1`;
      const [subscription] = await sql`SELECT state FROM miette_subscriptions WHERE user_id = ${user} AND livemode = ${live}
        AND state NOT IN ('canceled', 'incomplete_expired') ORDER BY updated_at DESC LIMIT 1`;
      return { active: Boolean(row), plan: row?.kind || null, until: row?.access_until || null, cancelAtPeriodEnd: row?.cancel_at_period_end || false, subscriptionStatus: subscription?.state || null };
    },
    async saveSubscription(value) {
      await sql`INSERT INTO miette_subscriptions (id, user_id, livemode, customer_id, state, access_until, cancel_at_period_end, payment_intent_id)
        SELECT ${value.id}, ${value.user}, ${value.live}, ${value.customer}, ${value.state}, ${value.until}, ${value.cancelAtPeriodEnd}, ${value.paymentIntent}
        WHERE EXISTS (SELECT 1 FROM miette_billing_customers WHERE user_id = ${value.user} AND livemode = ${value.live} AND closing = false)
        ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, access_until = EXCLUDED.access_until,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end, payment_intent_id = EXCLUDED.payment_intent_id, updated_at = now()`;
    },
    async savePass(value) {
      await sql`INSERT INTO miette_passes (id, user_id, livemode, customer_id, payment_intent_id, active, starts_at, access_until)
        SELECT ${value.id}, ${value.user}, ${value.live}, ${value.customer}, ${value.paymentIntent}, ${value.active}, ${value.start}, ${value.until}
        WHERE EXISTS (SELECT 1 FROM miette_billing_customers WHERE user_id = ${value.user} AND livemode = ${value.live} AND closing = false)
        ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active, updated_at = now()`;
    },
    async paymentRecords(payment, live) {
      return sql`SELECT id, 'pass' AS kind FROM miette_passes WHERE payment_intent_id = ${payment} AND livemode = ${live}
        UNION ALL SELECT id, 'monthly' AS kind FROM miette_subscriptions WHERE payment_intent_id = ${payment} AND livemode = ${live}`;
    },
    async eventSeen(id, live) { return (await sql`SELECT 1 FROM miette_billing_events WHERE id = ${id} AND livemode = ${live}`).length > 0; },
    async saveEvent(id, live) { await sql`INSERT INTO miette_billing_events (id, livemode) VALUES (${id}, ${live}) ON CONFLICT DO NOTHING`; },
    async trial(user) { return (await sql`SELECT start_date::text FROM miette_workshop_trials WHERE user_id = ${user}`)[0]?.start_date || null; },
    async claimTrial(user, start) {
      const rows = await sql`INSERT INTO miette_workshop_trials (user_id, start_date) VALUES (${user}, ${start}::date)
        ON CONFLICT (user_id) DO UPDATE SET start_date = miette_workshop_trials.start_date
        WHERE miette_workshop_trials.start_date = EXCLUDED.start_date RETURNING start_date`;
      return rows.length > 0;
    }
  };
}
module.exports = { billingStore };
