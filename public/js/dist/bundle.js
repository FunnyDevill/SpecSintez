function renderProduct(e,t){let a=e.image_url;e.images&&e.images.length&&(n=e.images.find(e=>e.is_main)||e.images[0],a=n.image_url);var n=e.images&&1<e.images.length?`
        <div class="product-gallery-vertical">
            <div class="gallery-thumbs-vertical">
                ${e.images.map(e=>`
                    <div class="gallery-thumb-vertical" data-image="${e.image_url}">
                        <img src="${e.image_url}" alt="Миниатюра" loading="lazy">
                    </div>
                `).join("")}
            </div>
        </div>
    `:"",i=e.package_types&&e.package_types.length?`
        <div class="product-package-icons-compact">
            <div class="package-icons-list-compact">
                ${e.package_types.map(e=>`
                    <div class="package-icon-item-compact">
                        <img src="${e.icon_url}" alt="${window.escapeHtml(e.name)}">
                        <span>${window.escapeHtml(e.name)}${e.volume?" "+window.escapeHtml(e.volume):""}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `:"";let r="",o=null,s=(e.options&&e.options.length&&(r=`
            <div class="product-options">
                <h3>Выберите вариант упаковки:</h3>
                <div class="options-list">
                    ${e.options.map(e=>`
                        <div class="option-item" data-option-id="${e.id}" data-image="${e.image_url||""}">
                            ${e.image_url?`<img src="${e.image_url}" class="option-icon">`:""}
                            <span class="option-name">${window.escapeHtml(e.name)}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `,o=e.options[0]?.id),"");e.categories&&e.categories.length&&(s=`
            <div class="product-industries">
                <h4>Применение в отраслях:</h4>
                <div class="product-industries__list">
                    ${e.categories.map(e=>{var t=(e.childCategory||e).id;return`
                            <a href="/catalog.html?category=${(e.childCategory||e).slug}&expand=${t}" class="product-industry-item">
                                <div class="industry-card__icon">
                                    ${window.getCategoryIconHtml(e)}
                                </div>
                                <span>${window.escapeHtml(e.name)}</span>
                            </a>
                        `}).join("")}
                </div>
            </div>
        `);n=`
        <article class="product-detail">
            <h1 class="product-detail__title">${window.escapeHtml(e.name)}</h1>
            <div class="product-media-row">
                <div class="product-main-image">
                    <img src="${a}" alt="${window.escapeHtml(e.name)}" id="mainProductImage">
                </div>
                ${n}
            </div>
            ${i}
            ${r}
            <div class="product-description">
                ${e.description||"<p>Описание отсутствует</p>"}
            </div>
            ${s}
            <a href="/catalog.html" class="back-link">← В каталог</a>
        </article>
        <div id="lightbox" class="lightbox">
            <span class="lightbox-close">&times;</span>
            <img class="lightbox-image" src="">
        </div>
    `;t.innerHTML=n;let c=document.getElementById("mainProductImage");if(t.querySelectorAll("img").forEach(e=>{e.addEventListener("error",function(){this.classList.add("image-hidden")})}),document.querySelectorAll(".gallery-thumb-vertical").forEach(e=>{e.addEventListener("click",()=>{c.src=e.dataset.image})}),e.options&&e.options.length){let t=document.querySelectorAll(".option-item"),a=e=>{t.forEach(e=>e.classList.remove("active")),e.classList.add("active");e=e.dataset.image;e&&(c.src=e)};t.forEach(e=>{e.addEventListener("click",()=>a(e))}),o&&(i=document.querySelector(`.option-item[data-option-id="${o}"]`))&&a(i)}let l=document.getElementById("lightbox"),d=l.querySelector(".lightbox-image");c.addEventListener("click",()=>{d.src=c.src,l.classList.add("lightbox--visible")}),l.querySelector(".lightbox-close").addEventListener("click",()=>{l.classList.remove("lightbox--visible")}),l.addEventListener("click",e=>{e.target===l&&l.classList.remove("lightbox--visible")})}function renderDetail(e,t){var a=window.formatDate(e.published_at);t.innerHTML=`
        <article class="news-detail">
            <time datetime="${e.published_at}" class="news-detail__date">${a}</time>
            <h1 class="news-detail__title">${window.escapeHtml(e.title)}</h1>
            ${e.image_url?`<img src="${e.image_url}" alt="${window.escapeHtml(e.title)}" class="news-detail__image">`:""}
            <div class="news-detail__content">${e.content}</div>
            <a href="/news.html" class="news-detail__back-link">← Все новости</a>
        </article>
    `}function renderIndustries(e,t){if(t.innerHTML="",e.length)for(var a of e){var n=document.createElement("a");n.className="industry-card",n.href="/catalog.html?category="+a.slug,n.innerHTML=`
            <div class="industry-card__icon">
                ${window.getCategoryIconHtml(a)}
            </div>
            <h3>${window.escapeHtml(a.name)}</h3>
            <p>${window.escapeHtml(a.description||"Подробнее")}</p>
        `,t.appendChild(n)}else t.innerHTML='<p class="error-message">Отрасли не найдены</p>'}function renderNews(e,t){if(t.innerHTML="",e.length)for(var a of e){var n=document.createElement("article"),i=(n.className="news-card",window.formatDate(a.published_at));n.innerHTML=`
            <div class="news-card__image-placeholder">
                ${a.image_url?`<img src="${a.image_url}"
                 alt="${window.escapeHtml(a.title)}"
                  class="cover-image"
                  loading="lazy">`:`
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Фото</span>
                `}
            </div>
            <div class="news-card__body">
                <time datetime="${a.published_at}">${i}</time>
                <h3>${window.escapeHtml(a.title)}</h3>
                <a href="/news/${a.slug}" class="news-card__link">Подробнее ›</a>
            </div>
        `,t.appendChild(n)}else t.innerHTML='<p class="error-message">Новостей пока нет</p>'}function renderProducts(e,t){if(t.innerHTML="",e.length)for(var a of e){var n=document.createElement("article"),a=(n.className="product-card",n.innerHTML=`
            <div class="product-card__image-placeholder">
                ${a.image_url?`<img src="${window.escapeHtml(a.image_url)}" alt="${window.escapeHtml(a.name)}" class="product-card__image">`:`
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                `}
            </div>
            <div class="product-card__body">
                <h3>${window.escapeHtml(a.name)}</h3>
                <p class="excerpt">${window.escapeHtml(a.excerpt||"")}</p>
                <a href="/product/${a.slug}" class="product-card__link">Подробнее ›</a>
            </div>
        `,t.appendChild(n),n.querySelector(".product-card__image"));a&&a.addEventListener("error",function(){this.classList.add("image-hidden"),this.parentElement.classList.add("fallback")})}else t.innerHTML='<p class="error-message">Нет доступных товаров</p>'}window.escapeHtml=function(e){return e?e.replace(/[&<>]/g,function(e){return"&"===e?"&amp;":"<"===e?"&lt;":">"===e?"&gt;":e}):""},window.formatDate=function(e){return e?(e=new Date(e)).getDate().toString().padStart(2,"0")+`.${(e.getMonth()+1).toString().padStart(2,"0")}.`+e.getFullYear():""},window.getCategoryIconHtml=function(e){return e.icon_svg&&e.icon_svg.trim()?e.icon_svg:`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>`},document.addEventListener("DOMContentLoaded",function(){let t=document.getElementById("burgerToggle"),a=document.getElementById("mainNav");function n(){t.setAttribute("aria-expanded","false"),a.classList.remove("open"),document.body.style.overflow=""}t&&a&&(t.addEventListener("click",function(e){e.stopPropagation(),"true"===t.getAttribute("aria-expanded")?n():(t.setAttribute("aria-expanded","true"),a.classList.add("open"),document.body.style.overflow="hidden")}),a.querySelectorAll(".main-nav__link").forEach(e=>{e.addEventListener("click",n)}),document.addEventListener("keydown",function(e){"Escape"===e.key&&a.classList.contains("open")&&(n(),t.focus())}),document.addEventListener("click",function(e){a.contains(e.target)||t.contains(e.target)||!a.classList.contains("open")||n()}))}),document.addEventListener("DOMContentLoaded",function(){let e=document.getElementById("scrollToTop");e&&(window.addEventListener("scroll",function(){500<window.scrollY?e.classList.add("visible"):e.classList.remove("visible")}),e.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"})}))}),document.addEventListener("DOMContentLoaded",function(){function e(e){var c=document.getElementById(e);c&&c.addEventListener("submit",async function(e){e.preventDefault();var n,i,r,o,s,e=new FormData(c),t=e.get("name")||"",a=e.get("phone")||"",e=e.get("form_type")||"cta";n=t,i=a,r=e,o=c,(t=document.querySelector(".cta-modal-overlay"))&&t.remove(),(s=document.createElement("div")).className="cta-modal-overlay",s.innerHTML=`
    <div class="cta-modal">
      <h3>Проверьте данные</h3>
      <div class="cta-modal__info">
        <p><strong>Имя:</strong> ${escapeHtml(n)}</p>
        <p><strong>Телефон:</strong> ${escapeHtml(i)}</p>
      </div>
      <textarea id="ctaModalMessage" rows="4" placeholder="Напишите ваш вопрс (необязательно для заполнения)"></textarea>
      <div class="cta-modal__buttons">
        <button class="cta-modal__button cta-modal__button--cancel" id="ctaModalCancel">Отмена</button>
        <button class="cta-modal__button cta-modal__button--send" id="ctaModalSend">Отправить</button>
      </div>
    </div>
  `,document.body.appendChild(s),document.getElementById("ctaModalCancel").addEventListener("click",function(){s.remove()}),document.getElementById("ctaModalSend").addEventListener("click",async function(){var e=document.getElementById("ctaModalMessage").value,e=new URLSearchParams({name:n,phone:i,message:e,form_type:r,city:"",email:"",department:""}).toString();try{var t=await fetch(o.action,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:e}),a=await t.json();s.remove(),t.ok?(alert("✅ Спасибо! Ваша заявка отправлена."),o.reset()):alert("❌ "+(a.error||"Ошибка сервера"))}catch(e){s.remove(),alert("❌ Произошла ошибка")}})})}e("contactForm"),e("ctaForm")}),document.addEventListener("DOMContentLoaded",async()=>{let a=[],c=null,r=[],o=1,s=12,n=document.getElementById("category-tree-container"),l=document.getElementById("products-grid-container"),t=document.getElementById("catalogSearchInput");var e=document.getElementById("catalogSearchBtn");let i=document.getElementById("catalogSearchClear"),d=document.getElementById("catalog-filters");try{var m=await fetch("/api/categories");if(!m.ok)throw new Error("Ошибка загрузки категорий");if(0===(a=await m.json()).length)return void(n.innerHTML='<p class="error-message">Категории не найдены</p>');var p=a.filter(e=>null===e.parent_id),u=p,g=(n.innerHTML="",document.createElement("ul"));g.className="tree-root",u.sort((e,t)=>(e.sort_order||0)-(t.sort_order||0));for(let s of u){let r=document.createElement("li"),o=(r.className="root-category",document.createElement("div"));o.className="tree-item",o.dataset.id=s.id,o.dataset.slug=s.slug,o.innerHTML=`
            <span class="toggle-icon">▶</span>
            ${window.escapeHtml(s.name)}
         `,o.addEventListener("click",async e=>{e.stopPropagation(),document.querySelectorAll("#category-tree-container .tree-item").forEach(e=>e.classList.remove("active")),o.classList.add("active"),c=s.id,b(s.id);e=r.querySelector(".children-container");if(e)e.classList.toggle("hidden"),o.querySelector(".toggle-icon").textContent=e.classList.contains("hidden")?"▶":"▼";else{var e=s.id,t=r,a=document.createElement("div");a.className="children-container";try{var n=await fetch(`/api/categories/${e}/children`);if(!n.ok)throw new Error("Ошибка загрузки");var i=await n.json();if(0<i.length){let n=document.createElement("ul");n.className="children-list",i.forEach(t=>{var e=document.createElement("li");let a=document.createElement("div");a.className="tree-item child-item",a.dataset.id=t.id,a.dataset.slug=t.slug,a.innerHTML=window.escapeHtml(t.name),a.addEventListener("click",e=>{e.stopPropagation(),document.querySelectorAll("#category-tree-container .tree-item").forEach(e=>e.classList.remove("active")),a.classList.add("active"),c=t.id,b(t.id);e=new URL(window.location);e.searchParams.set("category",t.slug),window.history.pushState({},"",e)}),e.appendChild(a),n.appendChild(e)}),a.appendChild(n)}}catch(e){console.error(e)}t.appendChild(a),await 0,o.querySelector(".toggle-icon").textContent="▼"}e=new URL(window.location);e.searchParams.set("category",s.slug),window.history.pushState({},"",e)}),r.appendChild(o),g.appendChild(r)}n.appendChild(g);var v,h,w=new URLSearchParams(window.location.search);let t=w.get("category"),e=null;if(!(e=t&&(v=a.find(e=>e.slug===t))?v.id:e)&&0<p.length&&(p.sort((e,t)=>(e.sort_order||0)-(t.sort_order||0)),e=p[0].id,(h=new URL(window.location)).searchParams.set("category",p[0].slug),window.history.replaceState({},"",h)),e){b(e);var y=w.get("expand");if(y){var f=parseInt(y,10),_=document.querySelector(`.tree-item[data-id="${f}"]`);if(_){document.querySelectorAll("#category-tree-container .tree-item").forEach(e=>e.classList.remove("active")),_.classList.add("active");let e=_.closest("li");for(;e;){var L=e.querySelector(":scope > .children-container");L&&L.classList.contains("hidden")&&(L.classList.remove("hidden"),L=e.querySelector(":scope > .tree-item .toggle-icon"))&&(L.textContent="▼"),e=e.parentElement?.closest("li")}b(f)}}}else l.innerHTML='<p class="no-products">Выберите категорию</p>'}catch(e){console.error(e),n.innerHTML='<p class="error-message">Не удалось загрузить категории</p>'}function E(){var e=t.value.trim();e&&(c=null,o=1,(async e=>{l.innerHTML='<div class="loading">Поиск товаров...</div>';try{var t=await fetch("/api/products?search="+encodeURIComponent(e));if(!t.ok)throw new Error("Ошибка поиска");r=await t.json(),o=1,0===r.length?l.innerHTML='<div class="no-products">Ничего не найдено</div>':(l.innerHTML="",k(r)),$(),i.classList.remove("hidden")}catch(e){console.error(e),l.innerHTML='<div class="error-message">Не удалось выполнить поиск</div>'}})(e))}async function b(t){if(t){l.innerHTML='<div class="loading">Загрузка товаров...</div>';var a=document.getElementById("filter-package-type")?.value||"",n=document.getElementById("filter-volume")?.value||"";let e="/api/products?category_id="+t;a&&(e+="&package_type="+a),n&&(e+="&volume="+n);try{var i=await fetch(e);if(!i.ok)throw new Error("Ошибка загрузки товаров");r=await i.json(),o=1,!function a(){if(!r.length)return l.innerHTML='<div class="no-products">В этой категории пока нет товаров</div>',void $();let n=Math.ceil(r.length/s);o>n&&(o=n);o<1&&(o=1);let e=(o-1)*s;let t=r.slice(e,e+s);l.innerHTML="";k(t);$();if(1<n){let e=document.createElement("div");e.className="catalog-pagination",e.innerHTML=H(o,n),l.parentNode.appendChild(e),e.querySelectorAll(".page-btn").forEach(t=>{t.addEventListener("click",()=>{let e=parseInt(t.dataset.page,10);e&&1<=e&&e<=n&&(o=e,a(),l.scrollIntoView({behavior:"smooth",block:"start"}))})})}}(),(async()=>{if(d)try{var[e]=await Promise.all([fetch("/api/package-types")]),t=await e.json();d.innerHTML=`
            <div class="catalog-filters__inner">
               <select id="filter-package-type" class="filter-select">
                  <option value="">Все типы упаковок</option>
                  ${t.map(e=>`<option value="${e.id}">${window.escapeHtml(e.name)}</option>`).join("")}
               </select>
               <button id="apply-filters" class="btn btn-primary">Применить</button>
               <button id="reset-filters" class="btn btn-outline">Сбросить</button>
            </div>
         `,document.getElementById("apply-filters").addEventListener("click",()=>{c&&b(c)}),document.getElementById("reset-filters").addEventListener("click",()=>{document.getElementById("filter-package-type").value="",c&&b(c)})}catch(e){console.error(e)}})()}catch(e){console.error(e),l.innerHTML='<div class="error-message">Не удалось загрузить товары</div>'}}}function $(){var e=document.querySelector(".catalog-pagination");e&&e.remove()}function k(e){for(var t of e){var a=document.createElement("article"),t=(a.className="product-card",a.innerHTML=`
            <div class="product-card__image-placeholder">
               <img src="${escapeHtml(t.image_url||"")}"
               alt="${escapeHtml(t.name)}"
               class="product-card__image" 
               loading="lazy">
            </div>
            <div class="product-card__body">
               <h3>${escapeHtml(t.name)}</h3>
               <p class="excerpt">${escapeHtml(t.excerpt||"")}</p>
               <a href="/product/${t.slug}" class="product-card__link">Подробнее ›</a>
            </div>
         `,l.appendChild(a),a.querySelector(".product-card__image"));t&&t.addEventListener("error",function(){this.classList.add("image-hidden"),this.parentElement.classList.add("fallback")})}}function H(t,a){let n=`<button class="page-btn" data-page="${t-1}" ${1===t?"disabled":""}>← Предыдущая</button>`;for(let e=1;e<=a;e++)n+=`<button class="page-btn ${e===t?"active":""}" data-page="${e}">${e}</button>`;return n+=`<button class="page-btn" data-page="${t+1}" ${t===a?"disabled":""}>Следующая →</button>`}e.addEventListener("click",E),t.addEventListener("keypress",e=>{"Enter"===e.key&&E()}),i.addEventListener("click",()=>{t.value="",i.classList.add("hidden");var e=a.filter(e=>null===e.parent_id);0<e.length&&(e.sort((e,t)=>(e.sort_order||0)-(t.sort_order||0)),b(e[0].id))})}),document.addEventListener("DOMContentLoaded",async()=>{var t=document.getElementById("product-detail-container");if(t){var e=window.location.pathname.split("/").pop();if(e)try{var a=await fetch("/api/products-by-slug/"+e);if(!a.ok)throw new Error("Товар не найден");renderProduct(await a.json(),t)}catch(e){console.error(e),t.innerHTML=`<p class="error-message">${e.message}</p>`}else t.innerHTML='<p class="error-message">Товар не найден</p>'}}),document.addEventListener("DOMContentLoaded",async()=>{var t=document.getElementById("news-detail-container");if(t){var e=window.location.pathname.split("/").pop();if(e)try{var a=await fetch("/api/news/"+e);if(!a.ok)throw new Error("Новость не найдена");renderDetail(await a.json(),t)}catch(e){console.error(e),t.innerHTML=`<p class="error-message">${e.message}</p>`}else t.innerHTML='<p class="error-message">Новость не найдена</p>'}}),document.addEventListener("DOMContentLoaded",async()=>{var t=document.getElementById("industriesGrid");if(t)try{var a=await fetch("/api/categories");if(!a.ok)throw new Error("Ошибка загрузки категорий");renderIndustries((await a.json()).filter(e=>null===e.parent_id),t)}catch(e){console.error("Отрасли:",e),t.innerHTML='<p class="error-message">Не удалось загрузить отрасли</p>'}a=document.querySelector(".news__grid");if(a)try{var n=await fetch("/api/news");if(!n.ok)throw new Error("Ошибка загрузки новостей");var i=await n.json();let e=[];i.hero&&e.push(i.hero),renderNews((e=e.concat(i.list||[])).slice(0,3),a)}catch(e){console.error("Новости:",e),a.innerHTML='<p class="error-message">Новости временно недоступны</p>'}t=document.querySelector(".products__grid");if(t)try{var e=await fetch("/api/random-products?limit=4");if(!e.ok)throw new Error("Ошибка загрузки товаров");renderProducts(await e.json(),t)}catch(e){console.error("Продукты:",e),t.innerHTML='<p class="error-message">Товары временно недоступны</p>'}});let sections=document.querySelectorAll(".industries, .about, .products, .news"),observer=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&e.target.classList.add("visible")})},{threshold:.1});function renderHeroNews(e,t){var a=window.formatDate(e.published_at);t.innerHTML=`
        <article class="hero-news">
            <div class="hero-news__content">
                <time datetime="${e.published_at}">${a}</time>
                <h2>${window.escapeHtml(e.title)}</h2>
                <p>${window.escapeHtml(e.excerpt||"")}</p>
                <a href="/news/${e.slug}" class="hero-news__link">Подробнее →</a>
            </div>
            <div class="hero-news__image-placeholder">
                ${e.image_url?`<img src="${e.image_url}" alt="${window.escapeHtml(e.title)}" class="cover-image">`:`
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Изображение</span>
                    `}
            </div>
        </article>
    `}function renderNewsGrid(e,t){for(var a of e){var n=document.createElement("article"),i=(n.className="news-card",window.formatDate(a.published_at));n.innerHTML=`
            <div class="news-card__image-placeholder">
                ${a.image_url?`<img src="${a.image_url}" alt="${window.escapeHtml(a.title)}" class="cover-image">`:`
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Фото</span>
                    `}
            </div>
            <div class="news-card__body">
                <time datetime="${a.published_at}">${i}</time>
                <h3>${window.escapeHtml(a.title)}</h3>
                <a href="/news/${a.slug}" class="news-card__link">Подробнее ›</a>
            </div>
        `,t.appendChild(n)}}sections.forEach(e=>observer.observe(e)),document.addEventListener("DOMContentLoaded",async()=>{var e=document.getElementById("hero-news-container"),t=document.getElementById("news-grid-container");if(e&&t)try{var a=await fetch("/api/news");if(!a.ok)throw new Error("Ошибка загрузки новостей");var n=await a.json();e.innerHTML="",t.innerHTML="",n.hero?renderHeroNews(n.hero,e):e.classList.add("hidden"),n.list&&n.list.length?renderNewsGrid(n.list,t):t.innerHTML='<p class="error-message">Новостей пока нет</p>'}catch(e){console.error(e),t.innerHTML='<p class="error-message">Не удалось загрузить новости</p>'}}),(()=>{var e;function t(){e.remove()}localStorage.getItem("cookieConsent")||((e=document.createElement("div")).className="cookie-overlay",e.innerHTML=`
    <div class="cookie-banner">
      <div class="cookie-banner__text">
        Мы используем cookie-файлы для улучшения работы сайта. Продолжая использовать сайт, вы соглашаетесь с 
        <a href="/privacy.html">Политикой конфиденциальности</a> и 
        <a href="/privacy.html">Политикой обработки персональных данных</a>.
      </div>
      <div class="cookie-banner__buttons">
      <button class="cookie-banner__button cookie-banner__button--accept" id="cookie-accept">Принять все</button>
        <button class="cookie-banner__button cookie-banner__button--decline" id="cookie-decline">Отклонить</button>
      </div>
    </div>
  `,document.body.appendChild(e),document.getElementById("cookie-accept").addEventListener("click",function(){localStorage.setItem("cookieConsent","true"),t()}),document.getElementById("cookie-decline").addEventListener("click",function(){localStorage.setItem("cookieConsent","false"),t()}))})();