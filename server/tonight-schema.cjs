'use strict';
async function migrateTonight(sql) {
  await sql`CREATE TABLE IF NOT EXISTS poum_tonight_profiles (owner text PRIMARY KEY, preferences jsonb NOT NULL DEFAULT '{}'::jsonb, trial_meal uuid, current_meal uuid, updated_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS poum_tonight_meals (id uuid PRIMARY KEY, owner text NOT NULL, recipe_id text NOT NULL, servings integer NOT NULL CHECK(servings BETWEEN 1 AND 6), checked jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','cooking','done')), share_hash text UNIQUE, share_expires timestamptz, revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS poum_tonight_owner ON poum_tonight_meals(owner, created_at DESC)`;
}
module.exports={migrateTonight};
