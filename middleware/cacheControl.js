const crypto = require('crypto');

module.exports = (maxAge = 300) => (req, res, next) => {
   // Сохраняем оригинальный res.send/res.json для перехвата ответа
   const originalSend = res.send.bind(res);
   const originalJson = res.json.bind(res);

   // Функция для генерации ETag из тела ответа
   const generateETag = (body) => {
      return crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
   };

   // Перехватываем res.json
   res.json = function (data) {
      const etag = generateETag(data);
      res.set('ETag', `"${etag}"`);
      res.set('Cache-Control', `public, max-age=${maxAge}`);

      // Проверяем If-None-Match
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === `"${etag}"`) {
         return res.status(304).end();
      }

      return originalJson(data);
   };

   // Перехватываем res.send
   res.send = function (data) {
      if (typeof data === 'string') {
         const etag = generateETag(data);
         res.set('ETag', `"${etag}"`);
         res.set('Cache-Control', `public, max-age=${maxAge}`);

         const ifNoneMatch = req.headers['if-none-match'];
         if (ifNoneMatch === `"${etag}"`) {
            return res.status(304).end();
         }
      }
      return originalSend(data);
   };

   next();
};