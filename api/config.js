const { handler, json, originOf } = require('../server/http.cjs');
module.exports = handler(async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Méthode non autorisée.' });
  json(res, 200, { version: '2.0.2', accounts: Boolean(process.env.DATABASE_URL && process.env.NEON_AUTH_BASE_URL), products: true, appURL: originOf(req) });
}, { publicRead: true });
