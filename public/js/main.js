// ========== ГЛОБАЛЬНЫЕ УТИЛИТЫ ==========
window.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
};

window.formatDate = function(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
};

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ИКОНОК КАТЕГОРИЙ ==========
window.getCategoryIconHtml = function(category) {
    // Иконка-заглушка (используется, если у категории нет своей иконки)
    const defaultIcon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>`;
    if (category.icon_svg && category.icon_svg.trim()) {
        return category.icon_svg;
    }
    return defaultIcon;
};

// ========== БУРГЕР-МЕНЮ ==========
document.addEventListener('DOMContentLoaded', function () {
    const burger = document.getElementById('burgerToggle');
    const nav = document.getElementById('mainNav');
    if (!burger || !nav) return;

    function closeMenu() {
        burger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        document.body.style.overflow = '';
    }

    function openMenu() {
        burger.setAttribute('aria-expanded', 'true');
        nav.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    burger.addEventListener('click', function (e) {
        e.stopPropagation();
        const expanded = burger.getAttribute('aria-expanded') === 'true';
        expanded ? closeMenu() : openMenu();
    });

    nav.querySelectorAll('.main-nav__link').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('open')) {
            closeMenu();
            burger.focus();
        }
    });

    document.addEventListener('click', function (e) {
        if (!nav.contains(e.target) && !burger.contains(e.target) && nav.classList.contains('open')) {
            closeMenu();
        }
    });
});

// ========== КНОПКА "НАВЕРХ" ==========
document.addEventListener('DOMContentLoaded', function () {
    const scrollBtn = document.getElementById('scrollToTop');
    if (!scrollBtn) return;

    window.addEventListener('scroll', function () {
        if (window.scrollY > 500) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });

    scrollBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// main.js – обработка всех форм обратной связи
document.addEventListener('DOMContentLoaded', function () {
  function setupFormAjax(formId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var messageDiv = document.createElement('div');
    messageDiv.id = formId + '-message';
    messageDiv.style.display = 'none';
    messageDiv.style.padding = '1rem';
    messageDiv.style.marginBottom = '1rem';
    messageDiv.style.borderRadius = '8px';
    form.parentNode.insertBefore(messageDiv, form);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      messageDiv.style.display = 'none';
      var formData = new FormData(form);
      // Преобразуем FormData в URL-кодированную строку
      var urlEncoded = new URLSearchParams(formData).toString();
      try {
        var res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: urlEncoded
        });
        var data = await res.json();
        if (res.ok) {
          messageDiv.style.display = 'block';
          messageDiv.style.background = '#d4edda';
          messageDiv.style.color = '#155724';
          messageDiv.textContent = '✅ Спасибо! Ваша заявка отправлена.';
          form.reset();
        } else {
          throw new Error(data.error || 'Ошибка сервера');
        }
      } catch (err) {
        messageDiv.style.display = 'block';
        messageDiv.style.background = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.textContent = '❌ ' + (err.message || 'Произошла ошибка');
      }
    });
  }

  setupFormAjax('contactForm');   // контрактная форма
  setupFormAjax('ctaForm');       // CTA в футере
});