const cache = new Map();

module.exports = {
   get(key) {
      const item = cache.get(key);
      if (!item) return null;
      
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
   
   // Удаление конкретного ключа
   del(key) {
      cache.delete(key);
   },
   
   // Удаление по паттерну (например, все ключи, начинающиеся с "categories")
   delByPattern(pattern) {
      for (const key of cache.keys()) {
         if (key.startsWith(pattern)) {
            cache.delete(key);
         }
      }
   },
   
   // Полная очистка
   clear() {
      cache.clear();
   }
};