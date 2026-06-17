const { requestHandler } = require('../server');

module.exports = async function vercelHandler(req, res) {
  if (req.url && req.url.startsWith('/api/bukti/')) {
    req.url = req.url.replace('/api/bukti/', '/bukti/');
  }

  return requestHandler(req, res);
};
