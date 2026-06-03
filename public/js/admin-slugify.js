// Единая клиентская функция slugify для всех форм админки
(function() {
   var map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd', 'Е': 'e', 'Ё': 'yo',
      'Ж': 'zh', 'З': 'z', 'И': 'i', 'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm',
      'Н': 'n', 'О': 'o', 'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't', 'У': 'u',
      'Ф': 'f', 'Х': 'h', 'Ц': 'ts', 'Ч': 'ch', 'Ш': 'sh', 'Щ': 'sch',
      'Ъ': '', 'Ы': 'y', 'Ь': '', 'Э': 'e', 'Ю': 'yu', 'Я': 'ya',
      ' ': '-', '_': '-', ',': '', '.': '', '!': '', '?': '', '"': '', "'": '',
      '(': '', ')': '', ':': '-', ';': '', '/': '-', '\\': '-'
   };

   window.AppSlugify = {
      generate: function(text) {
         if (!text) return '';
         return text.split('').map(function(c) { return map[c] || c; }).join('')
            .toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');
      },

      bindToFields: function(nameFieldId, slugFieldId) {
         var nameEl = document.getElementById(nameFieldId);
         var slugEl = document.getElementById(slugFieldId);
         if (!nameEl || !slugEl) return;

         var manual = slugEl.value.trim() !== '';

         nameEl.addEventListener('input', function() {
            if (!manual) {
               slugEl.value = window.AppSlugify.generate(this.value);
            }
         });

         slugEl.addEventListener('input', function() {
            manual = this.value.trim() !== '';
         });
      }
   };
})();