const { clearHash } = require("../services/cache");

module.exports = async (req, res, next) => {
  await next();
  // after excute the next() in which we insert the new blog then clear the old hash
  clearHash(req.user.id);
};
