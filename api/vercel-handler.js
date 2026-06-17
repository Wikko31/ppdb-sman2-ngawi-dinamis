const { ensureDb, requestHandler } = require('../server');

let ready;

module.exports = async function vercelHandler(req, res) {
  if (req.url && req.url.startsWith('/api/bukti/')) {
    req.url = req.url.replace('/api/bukti/', '/bukti/');
  }

  ready ||= ensureDb();
  await ready;
  return requestHandler(req, res);
};
