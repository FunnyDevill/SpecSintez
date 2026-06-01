document.addEventListener('DOMContentLoaded', async () => {
   let allCategories = [];
   let currentCategoryId = null;
   let allProducts = [];
   let currentPage = 1;
   const ITEMS_PER_PAGE = 12;

   const treeContainer = document.getElementById('category-tree-container');
   const productsContainer = document.getElementById('products-grid-container');
   const searchInput = document.getElementById('catalogSearchInput');
   const searchBtn = document.getElementById('catalogSearchBtn');
   const searchClear = document.getElementById('catalogSearchClear');
   const filtersContainer = document.getElementById('catalog-filters');

   try {
      // Загружаем только корневые категории для сайдбара
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Ошибка загрузки категорий');
      allCategories = await res.json();

      if (allCategories.length === 0) {
         treeContainer.innerHTML = '<p class="error-message">Категории не найдены</p>';
         return;
      }

      // Показываем только корневые категории
      const rootCategories = allCategories.filter(c => c.parent_id === null);
      renderRootCategories(rootCategories);

      const urlParams = new URLSearchParams(window.location.search);
      const categorySlug = urlParams.get('category');
      let targetId = null;

      if (categorySlug) {
         const found = allCategories.find(c => c.slug === categorySlug);
         if (found) targetId = found.id;
      }

      if (!targetId && rootCategories.length > 0) {
         rootCategories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
         targetId = rootCategories[0].id;
         const newUrl = new URL(window.location);
         newUrl.searchParams.set('category', rootCategories[0].slug);
         window.history.replaceState({}, '', newUrl);
      }

      if (targetId) {
         loadProducts(targetId);
         // Проверяем, нужно ли раскрыть дерево
         const expandId = urlParams.get('expand');
         if (expandId) {
            expandTreeToCategory(parseInt(expandId, 10));
         }
      } else {
         productsContainer.innerHTML = '<p class="no-products">Выберите категорию</p>';
      }

   } catch (err) {
      console.error(err);
      treeContainer.innerHTML = '<p class="error-message">Не удалось загрузить категории</p>';
   }

   // ========== Рендер корневых категорий (только отрасли) ==========
   function renderRootCategories(categories) {
      treeContainer.innerHTML = '';
      const ul = document.createElement('ul');
      ul.className = 'tree-root';

      categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      for (const cat of categories) {
         const li = document.createElement('li');
         li.className = 'root-category';

         const itemDiv = document.createElement('div');
         itemDiv.className = 'tree-item';
         itemDiv.dataset.id = cat.id;
         itemDiv.dataset.slug = cat.slug;
         itemDiv.innerHTML = `
            <span class="toggle-icon">▶</span>
            ${window.escapeHtml(cat.name)}
         `;

         // Загружаем дочерние категории при клике
         itemDiv.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            // Убираем активный класс у всех
            document.querySelectorAll('#category-tree-container .tree-item').forEach(el => el.classList.remove('active'));
            itemDiv.classList.add('active');
            currentCategoryId = cat.id;

            // Загружаем товары для этой категории
            loadProducts(cat.id);

            // Показываем дочерние категории (ленивая загрузка)
            const childrenContainer = li.querySelector('.children-container');
            if (childrenContainer) {
               childrenContainer.classList.toggle('hidden');
               const toggle = itemDiv.querySelector('.toggle-icon');
               toggle.textContent = childrenContainer.classList.contains('hidden') ? '▶' : '▼';
            } else {
               await loadChildren(cat.id, li);
               const toggle = itemDiv.querySelector('.toggle-icon');
               toggle.textContent = '▼';
            }

            const url = new URL(window.location);
            url.searchParams.set('category', cat.slug);
            window.history.pushState({}, '', url);
         });

         li.appendChild(itemDiv);
         ul.appendChild(li);
      }

      treeContainer.appendChild(ul);
   }

   // ========== Ленивая загрузка дочерних категорий ==========
   async function loadChildren(parentId, parentLi) {
      const container = document.createElement('div');
      container.className = 'children-container';

      try {
         const res = await fetch(`/api/categories/${parentId}/children`);
         if (!res.ok) throw new Error('Ошибка загрузки');
         const children = await res.json();

         if (children.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'children-list';

            children.forEach(child => {
               const li = document.createElement('li');
               const item = document.createElement('div');
               item.className = 'tree-item child-item';
               item.dataset.id = child.id;
               item.dataset.slug = child.slug;
               item.innerHTML = window.escapeHtml(child.name);

               item.addEventListener('click', (e) => {
                  e.stopPropagation();
                  document.querySelectorAll('#category-tree-container .tree-item').forEach(el => el.classList.remove('active'));
                  item.classList.add('active');
                  currentCategoryId = child.id;
                  loadProducts(child.id);
                  const url = new URL(window.location);
                  url.searchParams.set('category', child.slug);
                  window.history.pushState({}, '', url);
               });

               li.appendChild(item);
               ul.appendChild(li);
            });

            container.appendChild(ul);
         }
      } catch (err) {
         console.error(err);
      }

      parentLi.appendChild(container);
   }

   // ========== Поиск ==========
   function performSearch() {
      const query = searchInput.value.trim();
      if (!query) return;
      currentCategoryId = null;
      currentPage = 1;
      loadProductsBySearch(query);
   }

   async function loadProductsBySearch(query) {
      productsContainer.innerHTML = '<div class="loading">Поиск товаров...</div>';
      try {
         const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
         if (!res.ok) throw new Error('Ошибка поиска');
         allProducts = await res.json();
         currentPage = 1;
         if (allProducts.length === 0) {
            productsContainer.innerHTML = '<div class="no-products">Ничего не найдено</div>';
            removePagination();
         } else {
            productsContainer.innerHTML = '';
            renderProductCards(allProducts);
            removePagination();
         }
         searchClear.classList.remove('hidden');
      } catch (err) {
         console.error(err);
         productsContainer.innerHTML = '<div class="error-message">Не удалось выполнить поиск</div>';
      }
   }

   searchBtn.addEventListener('click', performSearch);
   searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
   searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      // Возвращаемся к первой категории
      const roots = allCategories.filter(c => c.parent_id === null);
      if (roots.length > 0) {
         roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
         loadProducts(roots[0].id);
      }
   });

   // ========== Загрузка товаров с фильтрами ==========
   async function loadProducts(categoryId) {
      if (!categoryId) return;
      productsContainer.innerHTML = '<div class="loading">Загрузка товаров...</div>';

      // Получаем значения фильтров
      const packageTypeFilter = document.getElementById('filter-package-type')?.value || '';
      const volumeFilter = document.getElementById('filter-volume')?.value || '';

      let url = `/api/products?category_id=${categoryId}`;
      if (packageTypeFilter) url += `&package_type=${packageTypeFilter}`;
      if (volumeFilter) url += `&volume=${volumeFilter}`;

      try {
         const res = await fetch(url);
         if (!res.ok) throw new Error('Ошибка загрузки товаров');
         allProducts = await res.json();
         currentPage = 1;
         renderPage();
         renderFilters();
      } catch (err) {
         console.error(err);
         productsContainer.innerHTML = '<div class="error-message">Не удалось загрузить товары</div>';
      }
   }

   // ========== Рендер фильтров ==========
   async function renderFilters() {
      if (!filtersContainer) return;

      try {
         const [packageTypesRes] = await Promise.all([
            fetch('/api/package-types')
         ]);

         const packageTypes = await packageTypesRes.json();

         filtersContainer.innerHTML = `
            <div class="catalog-filters__inner">
               <select id="filter-package-type" class="filter-select">
                  <option value="">Все типы упаковок</option>
                  ${packageTypes.map(pt => `<option value="${pt.id}">${window.escapeHtml(pt.name)}</option>`).join('')}
               </select>
               <button id="apply-filters" class="btn btn-primary">Применить</button>
               <button id="reset-filters" class="btn btn-outline">Сбросить</button>
            </div>
         `;

         document.getElementById('apply-filters').addEventListener('click', () => {
            if (currentCategoryId) loadProducts(currentCategoryId);
         });

         document.getElementById('reset-filters').addEventListener('click', () => {
            document.getElementById('filter-package-type').value = '';
            if (currentCategoryId) loadProducts(currentCategoryId);
         });
      } catch (err) {
         console.error(err);
      }
   }

   // ========== Рендер товаров ==========
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
               class="product-card__image" 
               loading="lazy">
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
            img.addEventListener('error', function() {
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

   // ========== Раскрытие дерева до указанной категории ==========
   function expandTreeToCategory(catId) {
      const targetItem = document.querySelector(`.tree-item[data-id="${catId}"]`);
      if (!targetItem) return;

      // Активируем целевую категорию
      document.querySelectorAll('#category-tree-container .tree-item').forEach(el => el.classList.remove('active'));
      targetItem.classList.add('active');

      // Раскрываем родительские категории
      let parentLi = targetItem.closest('li');
      while (parentLi) {
         const childrenContainer = parentLi.querySelector(':scope > .children-container');
         if (childrenContainer && childrenContainer.classList.contains('hidden')) {
            childrenContainer.classList.remove('hidden');
            const toggle = parentLi.querySelector(':scope > .tree-item .toggle-icon');
            if (toggle) toggle.textContent = '▼';
         }
         parentLi = parentLi.parentElement?.closest('li');
      }

      loadProducts(catId);
   }
});