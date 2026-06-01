document.addEventListener('DOMContentLoaded', async () => {
   // ========== 1. Загружаем отрасли (категории верхнего уровня) ==========
   const industriesGrid = document.getElementById('industriesGrid');
   if (industriesGrid) {
      try {
         const res = await fetch('/api/categories');
         if (!res.ok) throw new Error('Ошибка загрузки категорий');
         const allCategories = await res.json();
         const industries = allCategories.filter(cat => cat.parent_id === null);
         renderIndustries(industries, industriesGrid);
      } catch (err) {
         console.error('Отрасли:', err);
         industriesGrid.innerHTML = '<p class="error-message">Не удалось загрузить отрасли</p>';
      }
   }

   // ========== 2. Загружаем новости ==========
   const newsGrid = document.querySelector('.news__grid');
   if (newsGrid) {
      try {
         const res = await fetch('/api/news');
         if (!res.ok) throw new Error('Ошибка загрузки новостей');
         const data = await res.json();
         let allNews = [];
         if (data.hero) allNews.push(data.hero);
         allNews = allNews.concat(data.list || []);
         renderNews(allNews.slice(0, 3), newsGrid);
      } catch (err) {
         console.error('Новости:', err);
         newsGrid.innerHTML = '<p class="error-message">Новости временно недоступны</p>';
      }
   }

   // ========== 3. Загружаем случайные товары ==========
   const productsGrid = document.querySelector('.products__grid');
   if (productsGrid) {
      try {
         const res = await fetch('/api/random-products?limit=4');
         if (!res.ok) throw new Error('Ошибка загрузки товаров');
         const products = await res.json();
         renderProducts(products, productsGrid);
      } catch (err) {
         console.error('Продукты:', err);
         productsGrid.innerHTML = '<p class="error-message">Товары временно недоступны</p>';
      }
   }
});

// Функция рендера отраслей (карточки) с использованием общей функции иконок
function renderIndustries(industries, container) {
   container.innerHTML = '';
   if (!industries.length) {
      container.innerHTML = '<p class="error-message">Отрасли не найдены</p>';
      return;
   }
   for (const cat of industries) {
      const card = document.createElement('a');
      card.className = 'industry-card';
      card.href = `/catalog.html?category=${cat.slug}`;
      card.innerHTML = `
            <div class="industry-card__icon">
                ${window.getCategoryIconHtml(cat)}
            </div>
            <h3>${window.escapeHtml(cat.name)}</h3>
            <p>${window.escapeHtml(cat.description || 'Подробнее')}</p>
        `;
      container.appendChild(card);
   }
}

// Функция рендера новостей
function renderNews(newsList, container) {
   container.innerHTML = '';
   if (!newsList.length) {
      container.innerHTML = '<p class="error-message">Новостей пока нет</p>';
      return;
   }
   for (const item of newsList) {
      const card = document.createElement('article');
      card.className = 'news-card';
      const formattedDate = window.formatDate(item.published_at);
      card.innerHTML = `
            <div class="news-card__image-placeholder">
                ${item.image_url ? `<img src="${item.image_url}"
                 alt="${window.escapeHtml(item.title)}"
                  class="cover-image"
                  loading="lazy">` : `
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Фото</span>
                `}
            </div>
            <div class="news-card__body">
                <time datetime="${item.published_at}">${formattedDate}</time>
                <h3>${window.escapeHtml(item.title)}</h3>
                <a href="/news/${item.slug}" class="news-card__link">Подробнее ›</a>
            </div>
        `;
      container.appendChild(card);
   }
}

// Функция рендера товаров
function renderProducts(products, container) {
   container.innerHTML = '';
   if (!products.length) {
      container.innerHTML = '<p class="error-message">Нет доступных товаров</p>';
      return;
   }
   for (const prod of products) {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.innerHTML = `
            <div class="product-card__image-placeholder">
                ${prod.image_url ? `<img src="${window.escapeHtml(prod.image_url)}" alt="${window.escapeHtml(prod.name)}" class="product-card__image">` : `
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                `}
            </div>
            <div class="product-card__body">
                <h3>${window.escapeHtml(prod.name)}</h3>
                <p class="excerpt">${window.escapeHtml(prod.excerpt || '')}</p>
                <a href="/product/${prod.slug}" class="product-card__link">Подробнее ›</a>
            </div>
        `;
      container.appendChild(card);
      // обработка ошибки загрузки изображения
      const img = card.querySelector('.product-card__image');
      if (img) {
         img.addEventListener('error', function () {
            this.classList.add('image-hidden');
            this.parentElement.classList.add('fallback');
         });
      }
   }
}

// Плавное появление секций
const sections = document.querySelectorAll('.industries, .about, .products, .news');
const observer = new IntersectionObserver((entries) => {
   entries.forEach(entry => {
      if (entry.isIntersecting) {
         entry.target.classList.add('visible');
      }
   });
}, { threshold: 0.1 });
sections.forEach(section => observer.observe(section));