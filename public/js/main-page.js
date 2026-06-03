document.addEventListener("DOMContentLoaded", async () => {
  const industriesGrid = document.getElementById("industriesGrid");

  // ========== ЗАГРУЗКА НАПРАВЛЕНИЙ ==========
  if (industriesGrid) {
    try {
      const res = await fetch("/api/directions");
      if (!res.ok) throw new Error("Ошибка загрузки направлений");
      const directions = await res.json();
      renderDirections(directions, industriesGrid);
    } catch (err) {
      console.error("Направления:", err);
      industriesGrid.innerHTML =
        '<p class="error-message">Не удалось загрузить направления</p>';
    }
  }

  // ========== ЗАГРУЗКА НОВОСТЕЙ ==========
  const newsGrid = document.querySelector(".news__grid");
  if (newsGrid) {
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Ошибка загрузки новостей");
      const data = await res.json();
      let allNews = [];
      if (data.hero) allNews.push(data.hero);
      allNews = allNews.concat(data.list || []);
      renderNews(allNews.slice(0, 3), newsGrid);
    } catch (err) {
      console.error("Новости:", err);
      newsGrid.innerHTML =
        '<p class="error-message">Новости временно недоступны</p>';
    }
  }

  // ========== ЗАГРУЗКА ТОВАРОВ ==========
  const productsGrid = document.querySelector(".products__grid");
  if (productsGrid) {
    try {
      const res = await fetch("/api/random-products?limit=4");
      if (!res.ok) throw new Error("Ошибка загрузки товаров");
      const products = await res.json();
      renderProducts(products, productsGrid);
    } catch (err) {
      console.error("Продукты:", err);
      productsGrid.innerHTML =
        '<p class="error-message">Товары временно недоступны</p>';
    }
  }

  // ========== РЕНДЕР НАПРАВЛЕНИЙ ==========
  function renderDirections(directions, container) {
    container.innerHTML = "";
    if (!directions.length) {
      container.innerHTML =
        '<p class="error-message">Направления не найдены</p>';
      return;
    }
    for (const dir of directions) {
      const card = document.createElement("a");
      card.className = "industry-card";
      card.href = `/catalog.html?direction=${dir.id}`;
      card.innerHTML = `
            <div class="industry-card__icon">
               ${
                 dir.image_url
                   ? `<img src="${dir.image_url}" alt="${window.App.escapeHtml(dir.name)}" style="width:48px;height:48px;object-fit:contain;">`
                   : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                     </svg>`
               }
            </div>
            <h3>${window.App.escapeHtml(dir.name)}</h3>
         `;
      container.appendChild(card);
    }
  }

  // ========== РЕНДЕР НОВОСТЕЙ ==========
  function renderNews(newsList, container) {
    container.innerHTML = "";
    if (!newsList.length) {
      container.innerHTML = '<p class="error-message">Новостей пока нет</p>';
      return;
    }
    for (const item of newsList) {
      const card = document.createElement("article");
      card.className = "news-card";
      const formattedDate = window.App.formatDate(item.published_at);
      card.innerHTML = `
            <div class="news-card__image-placeholder">
                ${
                  item.image_url
                    ? `<img src="${item.image_url}" alt="${window.App.escapeHtml(item.title)}" class="cover-image" loading="lazy">`
                    : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                     </svg>
                     <span>Фото</span>`
                }
            </div>
            <div class="news-card__body">
                <time datetime="${item.published_at}">${formattedDate}</time>
                <h3>${window.App.escapeHtml(item.title)}</h3>
                <a href="/news/${item.slug}" class="news-card__link">Подробнее ›</a>
            </div>
         `;
      container.appendChild(card);
    }
  }

  // ========== РЕНДЕР ТОВАРОВ ==========
  function renderProducts(products, container) {
    container.innerHTML = "";
    if (!products.length) {
      container.innerHTML =
        '<p class="error-message">Нет доступных товаров</p>';
      return;
    }
    for (const prod of products) {
      const card = document.createElement("article");
      card.className = "product-card";
      card.style.cursor = "pointer";
      card.innerHTML = `
            <div class="product-card__image-placeholder">
                ${
                  prod.image_url
                    ? `<img src="${window.App.escapeHtml(prod.image_url)}" alt="${window.App.escapeHtml(prod.name)}" class="product-card__image">`
                    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                     </svg>`
                }
            </div>
            <div class="product-card__body">
                <h3>${window.App.escapeHtml(prod.name)}</h3>
                <p class="excerpt">${window.App.escapeHtml(prod.excerpt || "")}</p>
            </div>
         `;

      card.addEventListener("click", () => {
        openProductModal(prod.slug);
      });

      container.appendChild(card);

      const img = card.querySelector(".product-card__image");
      if (img) {
        img.addEventListener("error", function () {
          this.classList.add("image-hidden");
          this.parentElement.classList.add("fallback");
        });
      }
    }
  }

  // ========== МОДАЛЬНОЕ ОКНО ТОВАРА ==========
  async function openProductModal(slug) {
    let modal = document.getElementById("product-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "product-modal";
      modal.className = "product-modal-overlay hidden";
      modal.innerHTML = `
            <div class="product-modal">
               <button class="product-modal__close" id="modal-close">&times;</button>
               <div id="product-modal-content"></div>
            </div>
         `;
      document.body.appendChild(modal);

      modal.querySelector("#modal-close").addEventListener("click", () => {
        modal.classList.add("hidden");
        document.body.style.overflow = "";
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.add("hidden");
          document.body.style.overflow = "";
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
          modal.classList.add("hidden");
          document.body.style.overflow = "";
        }
      });
    }

    const modalContent = document.getElementById("product-modal-content");
    modal.classList.remove("hidden");
    modalContent.innerHTML = '<div class="loading">Загрузка...</div>';
    document.body.style.overflow = "hidden";

    try {
      const res = await fetch(`/api/products-by-slug/${slug}`);
      if (!res.ok) throw new Error("Товар не найден");
      const product = await res.json();

      let currentImage = product.image_url;
      if (product.images && product.images.length) {
        const main =
          product.images.find((img) => img.is_main) || product.images[0];
        currentImage = main.image_url;
      }

      const galleryHtml =
        product.images && product.images.length > 1
          ? `
            <div class="product-gallery-vertical">
               <div class="gallery-thumbs-vertical">
                  ${product.images
                    .map(
                      (img) => `
                     <div class="gallery-thumb-vertical ${img.image_url === currentImage ? "active" : ""}" data-image="${img.image_url}">
                        <img src="${img.image_url}" alt="Миниатюра" loading="lazy">
                     </div>
                  `,
                    )
                    .join("")}
               </div>
            </div>
         `
          : "";

      const packageHtml =
        product.package_types && product.package_types.length
          ? `
   <div class="product-package-icons-compact">
      <div class="package-icons-list-compact">
         ${product.package_types
           .map(
             (pt) => `
            <div class="package-icon-item-compact">
               ${pt.icon_url ? `<img src="${pt.icon_url}" alt="${window.App.escapeHtml(pt.volume || "")}">` : ""}
               <span>${pt.volume ? window.App.escapeHtml(pt.volume) : ""}</span>
            </div>
         `,
           )
           .join("")}
      </div>
   </div>
`
          : "";

      const propertiesHtml = product.properties
        ? `
            <div class="product-properties">
               <h4>Свойства</h4>
               <div class="product-properties-content">${product.properties}</div>
            </div>
         `
        : "";

      const directionsHtml =
        product.directions && product.directions.length
          ? `
            <div class="product-directions">
               <h4>Направления</h4>
               <div class="product-industries__list">
                  ${product.directions
                    .map(
                      (dir) => `
                     <div class="product-industry-item">
                        <div class="industry-card__icon">
                           ${dir.image_url ? `<img src="${dir.image_url}" alt="${window.App.escapeHtml(dir.name)}" style="width:36px;height:36px;object-fit:contain;">` : ""}
                        </div>
                        <span>${window.App.escapeHtml(dir.name)}</span>
                     </div>
                  `,
                    )
                    .join("")}
               </div>
            </div>
         `
          : "";

      modalContent.innerHTML = `
            <article class="product-detail">
               <h1 class="product-detail__title">${window.App.escapeHtml(product.name)}</h1>
               <div class="product-media-row">
                  <div class="product-main-image" id="modalMainImage">
                     <img src="${currentImage}" alt="${window.App.escapeHtml(product.name)}" id="modalMainImageImg">
                  </div>
                  ${galleryHtml}
               </div>
               ${packageHtml}
               <div class="product-description">
                  ${product.description || "<p>Описание отсутствует</p>"}
               </div>
               ${propertiesHtml}
               ${directionsHtml}
            </article>
            <div id="modalLightbox" class="lightbox">
               <span class="lightbox-close">&times;</span>
               <img class="lightbox-image" src="">
            </div>
         `;

      const mainImg = document.getElementById("modalMainImageImg");
      if (mainImg) {
        document
          .querySelectorAll(".gallery-thumb-vertical")
          .forEach((thumb) => {
            thumb.addEventListener("click", () => {
              mainImg.src = thumb.dataset.image;
              document
                .querySelectorAll(".gallery-thumb-vertical")
                .forEach((t) => t.classList.remove("active"));
              thumb.classList.add("active");
            });
          });

        document.querySelectorAll("img").forEach((img) => {
          img.addEventListener("error", function () {
            this.style.display = "none";
          });
        });

        const lightbox = document.getElementById("modalLightbox");
        if (lightbox) {
          const lightboxImg = lightbox.querySelector(".lightbox-image");
          document
            .getElementById("modalMainImage")
            .addEventListener("click", () => {
              lightboxImg.src = mainImg.src;
              lightbox.classList.add("lightbox--visible");
            });
          lightbox
            .querySelector(".lightbox-close")
            .addEventListener("click", () =>
              lightbox.classList.remove("lightbox--visible"),
            );
          lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox)
              lightbox.classList.remove("lightbox--visible");
          });
        }
      }
    } catch (err) {
      modalContent.innerHTML = `<p class="error-message">${err.message}</p>`;
    }
  }
});

// ========== ПЛАВНОЕ ПОЯВЛЕНИЕ СЕКЦИЙ ==========
const sections = document.querySelectorAll(
  ".industries, .about, .products, .news",
);
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.1 },
);
sections.forEach((section) => observer.observe(section));

// ========== ДИНАМИЧЕСКАЯ СМЕНА ТЕКСТА В HERO ==========
(function () {
  const typingElement = document.querySelector(".hero__typing");
  if (!typingElement) return;

  const phrases = [
    "для чистоты",
    "для дезинфекции",
    "для бизнеса",
    "для медицины",
  ];
  let i = 0;

  setInterval(() => {
    typingElement.style.opacity = "0";
    typingElement.style.transition = "opacity 0.3s ease";

    setTimeout(() => {
      typingElement.textContent = phrases[i];
      typingElement.style.opacity = "1";
      i = (i + 1) % phrases.length;
    }, 300);
  }, 3000);
})();
