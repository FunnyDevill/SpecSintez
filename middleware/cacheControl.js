module.exports = (maxAge = 300) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  next();
};