const { handler, json, readJSON, HttpError } = require('../server/http.cjs');
const { requireUser } = require('../server/auth.cjs');
const { database, limit } = require('../server/db.cjs');
const { validateNotebook } = require('../server/notebook.cjs');
module.exports = handler(async (req, res) => {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Méthode non autorisée.');
  const user = await requireUser(req);
  await limit('notebook:' + user.id, 90);
  const sql = database();
  if (req.method === 'GET') {
    const [row] = await sql`SELECT data, revision, updated_at FROM miette_notebooks WHERE user_id = ${user.id}`;
    return json(res, 200, row ? { notebook: row.data, revision: row.revision, updatedAt: row.updated_at } : { notebook: null, revision: 0 });
  }
  if (req.method === 'DELETE') {
    await sql`DELETE FROM miette_notebooks WHERE user_id = ${user.id}`;
    return json(res, 200, { deleted: true });
  }
  const body = await readJSON(req);
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0) throw new HttpError(400, 'La version du carnet est invalide.');
  const notebook = validateNotebook(body.notebook);
  const [row] = await sql`INSERT INTO miette_notebooks (user_id, data, revision)
    SELECT ${user.id}, ${JSON.stringify(notebook)}::jsonb, 1 WHERE ${body.revision} = 0
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, revision = miette_notebooks.revision + 1, updated_at = now()
    WHERE miette_notebooks.revision = ${body.revision} RETURNING revision, updated_at`;
  // Updates after revision zero use a separate compare-and-swap; the insert above only creates new notebooks.
  let updated = row;
  if (!updated && body.revision > 0) [updated] = await sql`UPDATE miette_notebooks SET data = ${JSON.stringify(notebook)}::jsonb,
    revision = revision + 1, updated_at = now() WHERE user_id = ${user.id} AND revision = ${body.revision} RETURNING revision, updated_at`;
  if (!updated) {
    const [latest] = await sql`SELECT data, revision FROM miette_notebooks WHERE user_id = ${user.id}`;
    throw new HttpError(409, 'Le carnet a changé sur un autre appareil.', { notebook: latest?.data || null, revision: latest?.revision || 0 });
  }
  json(res, 200, { revision: updated.revision, updatedAt: updated.updated_at });
});
