function renderDetail(news, container) {
  const formattedDate = window.App.formatDate(news.published_at);
  container.innerHTML = `
        <article class="news-detail">
            <time datetime="${news.published_at}" class="news-detail__date">${formattedDate}</time>
            <h1 class="news-detail__title">${window.App.escapeHtml(news.title)}</h1>
            ${news.image_url ? `<img src="${news.image_url}" alt="${window.App.escapeHtml(news.title)}" class="news-detail__image">` : ""}
            <div class="news-detail__content">${news.content}</div>
            <a href="/news.html" class="news-detail__back-link">← Все новости</a>
        </article>
    `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("news-detail-container");
  if (!container) return;

  const slug = window.location.pathname.split("/").pop();
  if (!slug) {
    container.innerHTML = '<p class="error-message">Новость не найдена</p>';
    return;
  }

  try {
    const response = await fetch(`/api/news/${slug}`);
    if (!response.ok) throw new Error("Новость не найдена");
    const news = await response.json();
    renderDetail(news, container);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error-message">${err.message}</p>`;
  }
});
