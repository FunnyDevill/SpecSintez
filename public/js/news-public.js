document.addEventListener('DOMContentLoaded', async () => {
   const heroContainer = document.getElementById('hero-news-container');
   const gridContainer = document.getElementById('news-grid-container');
   if (!heroContainer || !gridContainer) return;

   try {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error('Ошибка загрузки новостей');
      const data = await response.json();

      heroContainer.innerHTML = '';
      gridContainer.innerHTML = '';

      if (data.hero) {
         renderHeroNews(data.hero, heroContainer);
      } else {
         heroContainer.classList.add('hidden');
      }

      if (data.list && data.list.length) {
         renderNewsGrid(data.list, gridContainer);
      } else {
         gridContainer.innerHTML = '<p class="error-message">Новостей пока нет</p>';
      }
   } catch (err) {
      console.error(err);
      gridContainer.innerHTML = '<p class="error-message">Не удалось загрузить новости</p>';
   }
});

function renderHeroNews(news, container) {
   const formattedDate = window.formatDate(news.published_at);
   container.innerHTML = `
        <article class="hero-news">
            <div class="hero-news__content">
                <time datetime="${news.published_at}">${formattedDate}</time>
                <h2>${window.escapeHtml(news.title)}</h2>
                <p>${window.escapeHtml(news.excerpt || '')}</p>
                <a href="/news/${news.slug}" class="hero-news__link">Подробнее →</a>
            </div>
            <div class="hero-news__image-placeholder">
                ${news.image_url
         ? `<img src="${news.image_url}" alt="${window.escapeHtml(news.title)}" class="cover-image">`
         : `
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Изображение</span>
                    `
      }
            </div>
        </article>
    `;
}

function renderNewsGrid(newsList, container) {
   for (const item of newsList) {
      const card = document.createElement('article');
      card.className = 'news-card';
      const formattedDate = window.formatDate(item.published_at);
      card.innerHTML = `
            <div class="news-card__image-placeholder">
                ${item.image_url
            ? `<img src="${item.image_url}" alt="${window.escapeHtml(item.title)}" class="cover-image">`
            : `
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Фото</span>
                    `
         }
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