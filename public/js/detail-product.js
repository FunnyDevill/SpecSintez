document.addEventListener('DOMContentLoaded', async () => {
   const container = document.getElementById('product-detail-container');
   if (!container) return;

   const slug = window.location.pathname.split('/').pop();
   if (!slug) {
      container.innerHTML = '<p class="error-message">Товар не найден</p>';
      return;
   }

   try {
      const response = await fetch(`/api/products-by-slug/${slug}`);
      if (!response.ok) throw new Error('Товар не найден');
      const product = await response.json();
      renderProduct(product, container);
   } catch (err) {
      console.error(err);
      container.innerHTML = `<p class="error-message">${err.message}</p>`;
   }
});

function renderProduct(product, container) {
   let currentImage = product.image_url;
   if (product.images && product.images.length) {
      const main = product.images.find(img => img.is_main) || product.images[0];
      currentImage = main.image_url;
   }

   const galleryHtml = (product.images && product.images.length > 1) ? `
        <div class="product-gallery-vertical">
            <div class="gallery-thumbs-vertical">
                ${product.images.map(img => `
                    <div class="gallery-thumb-vertical" data-image="${img.image_url}">
                        <img src="${img.image_url}" alt="Миниатюра" loading="lazy">
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

   const packageIconsHtml = (product.package_types && product.package_types.length) ? `
        <div class="product-package-icons-compact">
            <div class="package-icons-list-compact">
                ${product.package_types.map(pt => `
                    <div class="package-icon-item-compact">
                        <img src="${pt.icon_url}" alt="${window.escapeHtml(pt.name)}">
                        <span>${window.escapeHtml(pt.name)}${pt.volume ? ' ' + window.escapeHtml(pt.volume) : ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

   let optionsHtml = '';
   let activeOptionId = null;
   if (product.options && product.options.length) {
      optionsHtml = `
            <div class="product-options">
                <h3>Выберите вариант упаковки:</h3>
                <div class="options-list">
                    ${product.options.map(opt => `
                        <div class="option-item" data-option-id="${opt.id}" data-image="${opt.image_url || ''}">
                            ${opt.image_url ? `<img src="${opt.image_url}" class="option-icon">` : ''}
                            <span class="option-name">${window.escapeHtml(opt.name)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
      activeOptionId = product.options[0]?.id;
   }

   // ========== БЛОК ОТРАСЛЕЙ ==========
   let industriesHtml = '';
   if (product.categories && product.categories.length) {
      industriesHtml = `
            <div class="product-industries">
                <h4>Применение в отраслях:</h4>
                <div class="product-industries__list">
                    ${product.categories.map(cat => {
         const expandId = cat.childCategory ? cat.childCategory.id : cat.id;
         const expandSlug = cat.childCategory ? cat.childCategory.slug : cat.slug;
         return `
                            <a href="/catalog.html?category=${expandSlug}&expand=${expandId}" class="product-industry-item">
                                <div class="industry-card__icon">
                                    ${window.getCategoryIconHtml(cat)}
                                </div>
                                <span>${window.escapeHtml(cat.name)}</span>
                            </a>
                        `;
      }).join('')}
                </div>
            </div>
        `;
   }

   const html = `
        <article class="product-detail">
            <h1 class="product-detail__title">${window.escapeHtml(product.name)}</h1>
            <div class="product-media-row">
                <div class="product-main-image">
                    <img src="${currentImage}" alt="${window.escapeHtml(product.name)}" id="mainProductImage">
                </div>
                ${galleryHtml}
            </div>
            ${packageIconsHtml}
            ${optionsHtml}
            <div class="product-description">
                ${product.description || '<p>Описание отсутствует</p>'}
            </div>
            ${industriesHtml}
            <a href="/catalog.html" class="back-link">← В каталог</a>
        </article>
        <div id="lightbox" class="lightbox">
            <span class="lightbox-close">&times;</span>
            <img class="lightbox-image" src="">
        </div>
    `;
   container.innerHTML = html;

   const mainImg = document.getElementById('mainProductImage');

   // Обработчики ошибок для всех изображений
   container.querySelectorAll('img').forEach(img => {
      img.addEventListener('error', function () {
         this.classList.add('image-hidden');
      });
   });

   // Миниатюры
   document.querySelectorAll('.gallery-thumb-vertical').forEach(thumb => {
      thumb.addEventListener('click', () => {
         mainImg.src = thumb.dataset.image;
      });
   });

   // Опции: подсветка активной и смена изображения
   if (product.options && product.options.length) {
      const optionItems = document.querySelectorAll('.option-item');
      const setActiveOption = (item) => {
         optionItems.forEach(opt => opt.classList.remove('active'));
         item.classList.add('active');
         const newImage = item.dataset.image;
         if (newImage) mainImg.src = newImage;
      };

      optionItems.forEach(opt => {
         opt.addEventListener('click', () => setActiveOption(opt));
      });

      if (activeOptionId) {
         const firstOpt = document.querySelector(`.option-item[data-option-id="${activeOptionId}"]`);
         if (firstOpt) setActiveOption(firstOpt);
      }
   }

   // Лайтбокс
   const lightbox = document.getElementById('lightbox');
   const lightboxImg = lightbox.querySelector('.lightbox-image');
   mainImg.addEventListener('click', () => {
      lightboxImg.src = mainImg.src;
      lightbox.classList.add('lightbox--visible');
   });
   lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
      lightbox.classList.remove('lightbox--visible');
   });
   lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.classList.remove('lightbox--visible');
   });
}