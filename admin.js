const adminRouter = require('./routes/admin');

module.exports = (upload) => {
   return adminRouter(upload);
};