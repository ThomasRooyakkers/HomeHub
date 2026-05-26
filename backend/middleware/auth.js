module.exports = (req, res, next) => {
  if (req.session?.userId) return next();
  res.status(401).json({ error: { code: 401, message: "Authentication required" } });
};
