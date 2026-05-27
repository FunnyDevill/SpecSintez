document.addEventListener('DOMContentLoaded', async () => {
   let allCategories = [];
   let currentCategoryId = null;
   let allProducts = [];
   let currentPage = 1;
   const ITEMS_PER_PAGE = 12;

   const treeContainer = document.getElementById('category-tree-container');
   const productsContainer = document.getElementById('products-grid-container');

   try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Ошибка загрузки категорий');
      allCategories = await res.json();

      if (allCategories.length === 0) {
         treeContainer.innerHTML = '<p class="error-message">Категории не найдены</p>';
         return;
      }

      const tree = renderCategoryTree(allCategories);
      treeContainer.innerHTML = '';
      treeContainer.appendChild(tree);

      const urlParams = new URLSearchParams(window.location.search);
      const categorySlug = urlParams.get('category');
      let targetId = null;

      if (categorySlug) {
         const found = allCategories.find(c => c.slug === categorySlug);
         if (found) targetId = found.id;
      }

      if (!targetId) {
         const roots = allCategories.filter(c => c.parent_id === null);
         if (roots.length) {
            roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            targetId = roots[0].id;
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('category', roots[0].slug);
            window.history.replaceState({}, '', newUrl);
         }
      }

      if (targetId) {
         const targetItem = document.querySelector(`.tree-item[data-id="${targetId}"]`);
         if (targetItem) targetItem.click();
         else loadProducts(targetId);
      } else {
         productsContainer.innerHTML = '<p class="no-products">Выберите категорию</p>';
      }

   } catch (err) {
      console.error(err);
      treeContainer.innerHTML = '<p class="error-message">Не удалось загрузить категории</p>';
   }

   function renderCategoryTree(categories, parentId = null) {
      const children = categories.filter(c => c.parent_id === parentId);
      if (!children.length) return null;

      const ul = document.createElement('ul');
      ul.className = 'tree-node';
      children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      for (const cat of children) {
         const li = document.createElement('li');
         li.className = 'tree-item-wrapper';

         const itemDiv = document.createElement('div');
         itemDiv.className = 'tree-item';
         itemDiv.dataset.id = cat.id;
         itemDiv.dataset.slug = cat.slug;
         itemDiv.textContent = cat.name;

         const hasChildren = categories.some(c => c.parent_id === cat.id);
         let toggleSpan = null;
         if (hasChildren) {
            toggleSpan = document.createElement('span');
            toggleSpan.className = 'toggle-icon';
            toggleSpan.textContent = '▶';
            itemDiv.prepend(toggleSpan);

            toggleSpan.addEventListener('click', (e) => {
               e.stopPropagation();
               const childrenUl = li.querySelector(':scope > ul.tree-node');
               if (!childrenUl) return;
               if (childrenUl.classList.contains('hidden')) {
                  // закрываем все другие открытые поддеревья на том же уровне
                  const parentUl = li.parentElement;
                  if (parentUl) {
                     parentUl.querySelectorAll(':scope > li.tree-item-wrapper > ul.tree-node').forEach(ul => {
                        if (ul !== childrenUl && !ul.classList.contains('hidden')) {
                           ul.classList.add('hidden');
                           const siblingToggle = ul.closest('li')?.querySelector(':scope > .tree-item .toggle-icon');
                           if (siblingToggle) siblingToggle.textContent = '▶';
                        }
                     });
                  }
                  childrenUl.classList.remove('hidden');
                  toggleSpan.textContent = '▼';
               } else {
                  childrenUl.classList.add('hidden');
                  toggleSpan.textContent = '▶';
               }
            });
         }

         itemDiv.addEventListener('click', (e) => {
            if (toggleSpan && e.target === toggleSpan) return;
            setActiveCategory(itemDiv);
            loadProducts(cat.id);
            const url = new URL(window.location);
            url.searchParams.set('category', cat.slug);
            window.history.pushState({}, '', url);
         });

         li.appendChild(itemDiv);
         const childUl = renderCategoryTree(categories, cat.id);
         if (childUl) {
            childUl.classList.add('hidden');
            li.appendChild(childUl);
            if (toggleSpan) toggleSpan.textContent = '▶';
         }
         ul.appendChild(li);
      }
      return ul;
   }

   function setActiveCategory(el) {
      document.querySelectorAll('#category-tree-container .tree-item').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      currentCategoryId = el.dataset.id;
   }

   async function loadProducts(categoryId) {
      if (!categoryId) return;
      productsContainer.innerHTML = '<div class="loading">Загрузка товаров...</div>';
      try {
         const res = await fetch(`/api/products?category_id=${categoryId}`);
         if (!res.ok) throw new Error('Ошибка загрузки товаров');
         allProducts = await res.json();
         currentPage = 1;
         renderPage();
      } catch (err) {
         console.error(err);
         productsContainer.innerHTML = '<div class="error-message">Не удалось загрузить товары</div>';
      }
   }

   function renderPage() {
      if (!allProducts.length) {
         productsContainer.innerHTML = '<div class="no-products">В этой категории пока нет товаров</div>';
         removePagination();
         return;
      }

      const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const pageProducts = allProducts.slice(start, start + ITEMS_PER_PAGE);

      productsContainer.innerHTML = '';
      renderProductCards(pageProducts);

      removePagination();
      if (totalPages > 1) {
         const pagination = document.createElement('div');
         pagination.className = 'catalog-pagination';
         pagination.innerHTML = buildPaginationHTML(currentPage, totalPages);
         productsContainer.parentNode.appendChild(pagination);

         pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
               const page = parseInt(btn.dataset.page, 10);
               if (page && page >= 1 && page <= totalPages) {
                  currentPage = page;
                  renderPage();
                  productsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
               }
            });
         });
      }
   }

   function removePagination() {
      const existing = document.querySelector('.catalog-pagination');
      if (existing) existing.remove();
   }

   function renderProductCards(products) {
      for (const prod of products) {
         const card = document.createElement('article');
         card.className = 'product-card';
         card.innerHTML = `
            <div class="product-card__image-placeholder">
                <img src="${escapeHtml(prod.image_url || '')}" 
                     alt="${escapeHtml(prod.name)}"
                     class="product-card__image">
            </div>
            <div class="product-card__body">
                <h3>${escapeHtml(prod.name)}</h3>
                <p class="excerpt">${escapeHtml(prod.excerpt || '')}</p>
                <a href="/product/${prod.slug}" class="product-card__link">Подробнее ›</a>
            </div>
        `;
         productsContainer.appendChild(card);
         const img = card.querySelector('.product-card__image');
         if (img) {
            img.addEventListener('error', function () {
               this.classList.add('image-hidden');
               this.parentElement.classList.add('fallback');
            });
         }
      }
   }

   function buildPaginationHTML(current, total) {
      let html = `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>← Предыдущая</button>`;
      for (let i = 1; i <= total; i++) {
         html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
      html += `<button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>Следующая →</button>`;
      return html;
   }
});