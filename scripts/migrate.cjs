'use strict';
const { database } = require('../server/db.cjs');
(async () => {
  const sql = database();
  await sql`CREATE TABLE IF NOT EXISTS miette_notebooks (
    user_id text PRIMARY KEY, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now(), CHECK (octet_length(data::text) <= 250000)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS miette_limits (key text PRIMARY KEY, bucket bigint NOT NULL, hits integer NOT NULL)`;
  await sql`DELETE FROM miette_limits WHERE bucket < ${Math.floor(Date.now() / 60000) - 1440}`;
  await require('../server/billing-schema.cjs').migrateBilling(sql);
  console.log('Poum: notebook, billing and request-limit tables ready.');
})().catch(error => { console.error('Database initialization failed:', error.code || error.name); process.exitCode = 1; });
