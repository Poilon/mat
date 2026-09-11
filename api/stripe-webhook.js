const Stripe = require('stripe');
const { json, HttpError } = require('../server/http.cjs');
const { settings, service } = require('../server/billing.cjs');
async function rawBody(req, maximum = 1024 * 1024) {
  if (Buffer.isBuffer(req.body)) { if (req.body.length > maximum) throw new HttpError(413, 'Événement trop volumineux.'); return req.body; }
  if (typeof req.body === 'string') { if (Buffer.byteLength(req.body) > maximum) throw new HttpError(413, 'Événement trop volumineux.'); return Buffer.from(req.body); }
  if (req.body !== undefined) throw new HttpError(400, 'Le corps brut de l’événement est nécessaire.');
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += Buffer.byteLength(chunk); if (length > maximum) throw new HttpError(413, 'Événement trop volumineux.'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
    const config = settings();
    if (!config.webhookSecret) throw new HttpError(503, 'La réception des paiements est en cours de configuration.');
    const body = await rawBody(req);
    let event;
    try { event = Stripe.webhooks.constructEvent(body, req.headers['stripe-signature'], config.webhookSecret); }
    catch { throw new HttpError(400, 'Signature Stripe invalide.'); }
    if (!config.configured) throw new HttpError(503, 'La réception des paiements est en cours de configuration.');
    json(res, 200, await service().webhook(event));
  } catch (error) {
    if (!error.status) console.error('Poum billing webhook:', error.name, error.code || 'upstream');
    json(res, error.status || 503, { error: error.status ? error.message : 'Réception temporairement indisponible.' });
  }
};
// Vercel's Web Handler avoids the Node helpers that parse JSON before signing checks.
// The Node handler is retained for the local development server.
module.exports.fetch = async request => {
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = body; } };
  try {
    const body = await rawBody(request.body || { body: Buffer.alloc(0) });
    await module.exports({ method: request.method, headers: Object.fromEntries(request.headers), body }, response);
  } catch (error) { json(response, error.status || 503, { error: error.status ? error.message : 'Réception temporairement indisponible.' }); }
  return new Response(response.body, { status: response.statusCode, headers: { 'Cache-Control': 'no-store', ...response.headers } });
};
module.exports.rawBody = rawBody;
