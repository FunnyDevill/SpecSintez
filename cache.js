const cache = new Map();

module.exports = {
   get(key) {
      const item = cache.get(key);
      if (!item) return null;
      
      // Проверяем время жизни (5 минут по умолчанию)
      if (Date.now() > item.expiry) {
         cache.delete(key);
         return null;
      }
      
      return item.value;
   },
   
   set(key, value, ttlSeconds = 300) {
      cache.set(key, {
         value,
         expiry: Date.now() + (ttlSeconds * 1000)
      });
   },
   
   clear() {
      cache.clear();
   }
};