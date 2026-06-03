document.addEventListener("DOMContentLoaded", async () => {
  let allCategories = [];
  let allProducts = [];
  let currentPage = 1;
  const ITEMS_PER_PAGE = 9;
  let activeCategory = null;
  let activeSubcategory = null;
  let activeDirections = [];

  const categoryAccordion = document.getElementById("category-accordion");
  const productsGrid = document.getElementById("products-grid");
  const searchInput = document.getElementById("catalogSearchInput");
  const directionFilters = document.getElementById("direction-filters");
  const paginationContainer = document.getElementById("pagination-container");
  const modal = document.getElementById("product-modal");
  const modalContent = document.getElementById("product-modal-content");
  const modalClose = document.getElementById("modal-close");

  try {
    const [catRes, prodRes, dirRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/products?all=true"),
      fetch("/api/directions"),
    ]);

    allCategories = await catRes.json();
    allProducts = (await prodRes.json()).filter((p) => p.is_active);
    const directions = await dirRes.json();

    console.log("Загружено товаров:", allProducts.length);
    console.log("Пример товара:", allProducts[0]);

    renderCategoryAccordion();
    renderDirections(directions);

    // Обработка URL-параметров при загрузке
    const urlParams = new URLSearchParams(window.location.search);
    const directionParam = urlParams.get("direction");
    const categoryParam = urlParams.get("category");
    const expandParam = urlParams.get("expand");

    if (directionParam) {
      const dirId = parseInt(directionParam, 10);
      if (!isNaN(dirId)) {
        const chip = document.querySelector(
          `.direction-chip[data-direction="${dirId}"]`,
        );
        if (chip) {
          chip.classList.add("active");
          activeDirections.push(dirId);
        }
      }
    }

    if (categoryParam) {
      const cat = allCategories.find((c) => c.slug === categoryParam);
      if (cat) {
        activeCategory = cat.id;

        if (expandParam) {
          const expandId = parseInt(expandParam, 10);
          if (!isNaN(expandId)) {
            const expandCat = allCategories.find((c) => c.id === expandId);
            if (expandCat && expandCat.parent_id) {
              activeCategory = expandCat.parent_id;
              activeSubcategory = expandCat.id;
            }
          }
        }
      }
    }

    if (activeDirections.length > 0 || activeCategory) {
      filterAndRender();
    } else {
      renderPage(allProducts);
    }
  } catch (err) {
    console.error(err);
    productsGrid.innerHTML = '<p class="error-message">Ошибка загрузки</p>';
  }

  function renderCategoryAccordion() {
    const rootCats = allCategories.filter((c) => c.parent_id === null);

    categoryAccordion.innerHTML = rootCats
      .map(
        (cat) => `
         <div class="accordion-item">
            <div class="accordion-header" data-category="${cat.id}">
               <span>${window.App.escapeHtml(cat.name)}</span>
               <span class="accordion-arrow">▼</span>
            </div>
            <div class="accordion-body" id="body-${cat.id}"></div>
         </div>
      `,
      )
      .join("");

    categoryAccordion
      .querySelectorAll(".accordion-header")
      .forEach((header) => {
        header.addEventListener("click", async () => {
          const catId = parseInt(header.dataset.category);
          const body = document.getElementById(`body-${catId}`);
          const isOpen = body.classList.contains("open");

          categoryAccordion
            .querySelectorAll(".accordion-body")
            .forEach((b) => b.classList.remove("open"));
          categoryAccordion
            .querySelectorAll(".accordion-header")
            .forEach((h) => {
              if (h !== header) h.classList.remove("active");
            });

          if (!isOpen) {
            body.classList.add("open");
            header.classList.add("active");

            if (!body.dataset.loaded) {
              try {
                const res = await fetch(`/api/categories/${catId}/children`);
                const children = await res.json();

                body.innerHTML =
                  children.length > 0
                    ? children
                        .map(
                          (sub) => `
                        <div class="accordion-subitem" data-category="${catId}" data-subcategory="${sub.id}">
                           ${window.App.escapeHtml(sub.name)}
                        </div>
                     `,
                        )
                        .join("")
                    : '<div class="accordion-subitem" style="color:var(--white-dim);cursor:default;">Нет подкатегорий</div>';

                body.dataset.loaded = "true";

                body
                  .querySelectorAll(".accordion-subitem")
                  .forEach((subItem) => {
                    subItem.addEventListener("click", (e) => {
                      e.stopPropagation();
                      body
                        .querySelectorAll(".accordion-subitem")
                        .forEach((s) => s.classList.remove("active"));
                      subItem.classList.add("active");

                      activeCategory = parseInt(subItem.dataset.category);
                      activeSubcategory = parseInt(subItem.dataset.subcategory);
                      currentPage = 1;
                      filterAndRender();

                      const subCat = allCategories.find(
                        (c) => c.id === activeSubcategory,
                      );
                      if (subCat) {
                        const url = new URL(window.location);
                        url.searchParams.set("category", subCat.slug);
                        url.searchParams.set("expand", subCat.id);
                        window.history.pushState({}, "", url);
                      }
                    });
                  });
              } catch (err) {
                console.error("Ошибка загрузки подкатегорий:", err);
              }
            }

            activeCategory = catId;
            activeSubcategory = null;
            currentPage = 1;
            filterAndRender();

            const rootCat = allCategories.find((c) => c.id === catId);
            if (rootCat) {
              const url = new URL(window.location);
              url.searchParams.set("category", rootCat.slug);
              url.searchParams.delete("expand");
              window.history.pushState({}, "", url);
            }
          } else {
            activeCategory = null;
            activeSubcategory = null;
            currentPage = 1;
            filterAndRender();

            const url = new URL(window.location);
            url.searchParams.delete("category");
            url.searchParams.delete("expand");
            window.history.pushState({}, "", url);
          }
        });
      });
  }

  function renderDirections(dirs) {
    directionFilters.innerHTML = dirs
      .map(
        (dir) => `
         <button class="direction-chip" data-direction="${dir.id}">${dir.name}</button>
      `,
      )
      .join("");

    directionFilters.querySelectorAll(".direction-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const dirId = parseInt(chip.dataset.direction);

        if (activeDirections.includes(dirId)) {
          activeDirections = activeDirections.filter((d) => d !== dirId);
          chip.classList.remove("active");
        } else {
          activeDirections.push(dirId);
          chip.classList.add("active");
        }

        console.log("Активные направления:", activeDirections);
        currentPage = 1;
        filterAndRender();

        const url = new URL(window.location);
        url.searchParams.delete("direction");
        activeDirections.forEach((d) =>
          url.searchParams.append("direction", d),
        );
        window.history.pushState({}, "", url);
      });
    });
  }

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    filterAndRender();
  });

  function filterAndRender() {
    let filtered = [...allProducts];
    const query = searchInput.value.trim().toLowerCase();

    if (query) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
    }

    if (activeCategory) {
      if (activeSubcategory) {
        const subId = activeSubcategory;
        filtered = filtered.filter((p) => {
          return p.categories && p.categories.some((c) => c.id === subId);
        });
      } else {
        const catId = activeCategory;
        filtered = filtered.filter((p) => {
          return (
            p.categories &&
            p.categories.some((c) => c.id === catId || c.parent_id === catId)
          );
        });
      }
    }

    if (activeDirections.length > 0) {
      filtered = filtered.filter((p) => {
        if (!p.directions || p.directions.length === 0) return false;
        return activeDirections.every((dirId) =>
          p.directions.some((d) => d.id === dirId),
        );
      });
    }

    renderPage(filtered);
  }

  function renderPage(products) {
    if (products.length === 0) {
      productsGrid.innerHTML = '<p class="no-products">Товары не найдены</p>';
      paginationContainer.innerHTML = "";
      return;
    }
    const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageProducts = products.slice(start, start + ITEMS_PER_PAGE);

    productsGrid.innerHTML = pageProducts
      .map(
        (prod) => `
         <article class="product-card" data-slug="${prod.slug}">
            <div class="product-card__image-placeholder">
               ${prod.image_url ? `<img src="${prod.image_url}" alt="${window.App.escapeHtml(prod.name)}" loading="lazy">` : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'}
            </div>
            <div class="product-card__body">
               <h3>${window.App.escapeHtml(prod.name)}</h3>
               <p class="excerpt">${window.App.escapeHtml(prod.excerpt || "")}</p>
            </div>
         </article>
      `,
      )
      .join("");

    productsGrid.querySelectorAll(".product-card").forEach((card) => {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => openProductModal(card.dataset.slug));
    });

    if (totalPages > 1) {
      paginationContainer.innerHTML = buildPagination(currentPage, totalPages);
      paginationContainer.querySelectorAll(".page-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentPage = parseInt(btn.dataset.page);
          filterAndRender();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    } else {
      paginationContainer.innerHTML = "";
    }
  }

  function buildPagination(current, total) {
    let html = `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? "disabled" : ""}>←</button>`;
    for (let i = 1; i <= total; i++) {
      html += `<button class="page-btn ${i === current ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" data-page="${current + 1}" ${current === total ? "disabled" : ""}>→</button>`;
    return html;
  }

  async function openProductModal(slug) {
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
<a href="/catalog.html?direction=${dir.id}" class="product-industry-item" onclick="event.stopPropagation()">
   <div class="industry-card__icon">
      ${dir.image_url ? `<img src="${dir.image_url}" alt="${window.App.escapeHtml(dir.name)}" style="width:36px;height:36px;object-fit:contain;">` : ""}
   </div>
   <span>${window.App.escapeHtml(dir.name)}</span>
</a>
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

  modalClose.addEventListener("click", () => {
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
});
