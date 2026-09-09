'use strict';
const { neon } = require('@neondatabase/serverless');
const { HttpError } = require('./http.cjs');
let client;
function database() {
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'La sauvegarde en ligne n’est pas configurée. Votre carnet reste sur cet appareil.');
  return client ||= neon(process.env.DATABASE_URL);
}
async function limit(key, maximum, seconds = 60) {
  const sql = database();
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const [entry] = await sql`INSERT INTO miette_limits (key, bucket, hits) VALUES (${key}, ${bucket}, 1)
    ON CONFLICT (key) DO UPDATE SET bucket = EXCLUDED.bucket,
    hits = CASE WHEN miette_limits.bucket = EXCLUDED.bucket THEN miette_limits.hits + 1 ELSE 1 END
    RETURNING hits`;
  if (entry.hits > maximum) throw new HttpError(429, 'Vous avez effectué plusieurs demandes rapprochées. Réessayez dans une minute.');
}
module.exports = { database, limit };
