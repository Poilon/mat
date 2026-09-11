'use strict';
async function migrateBilling(sql) {
  await sql`CREATE TABLE IF NOT EXISTS miette_billing_customers (
    user_id text NOT NULL, livemode boolean NOT NULL, customer_id text UNIQUE NOT NULL,
    checkout_id text, checkout_plan text, checkout_expires timestamptz, closing boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, livemode)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS miette_subscriptions (
    id text PRIMARY KEY, user_id text NOT NULL, livemode boolean NOT NULL, customer_id text NOT NULL,
    state text NOT NULL, access_until timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false,
    payment_intent_id text, updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS miette_subscriptions_user ON miette_subscriptions (user_id, livemode)`;
  await sql`CREATE TABLE IF NOT EXISTS miette_passes (
    id text PRIMARY KEY, user_id text NOT NULL, livemode boolean NOT NULL, customer_id text NOT NULL,
    payment_intent_id text UNIQUE NOT NULL, active boolean NOT NULL, starts_at timestamptz NOT NULL,
    access_until timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS miette_passes_user ON miette_passes (user_id, livemode)`;
  await sql`CREATE TABLE IF NOT EXISTS miette_billing_events (id text NOT NULL, livemode boolean NOT NULL, processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id, livemode))`;
  await sql`CREATE TABLE IF NOT EXISTS miette_billing_locks (key text PRIMARY KEY, token text NOT NULL, expires_at timestamptz NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS miette_workshop_trials (user_id text PRIMARY KEY, start_date date NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
}
module.exports = { migrateBilling };
