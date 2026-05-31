// ========== ГЛОБАЛЬНЫЕ УТИЛИТЫ ==========
window.escapeHtml = function (str) {
   if (!str) return '';
   return str.replace(/[&<>]/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
   });
};

window.formatDate = function (isoString) {
   if (!isoString) return '';
   const date = new Date(isoString);
   const day = date.getDate().toString().padStart(2, '0');
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const year = date.getFullYear();
   return `${day}.${month}.${year}`;
};

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ИКОНОК КАТЕГОРИЙ ==========
window.getCategoryIconHtml = function (category) {
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

  // Вместо сообщения делаем модальное окно
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var formData = new FormData(form);

    var name = formData.get('name') || '';
    var phone = formData.get('phone') || '';
    var formType = formData.get('form_type') || 'cta';

    function showCtaModal(name, phone, formType, originalForm) {
  // Удаляем предыдущее окно, если есть
  var oldOverlay = document.querySelector('.cta-modal-overlay');
  if (oldOverlay) oldOverlay.remove();

  var overlay = document.createElement('div');
  overlay.className = 'cta-modal-overlay';
  overlay.innerHTML = `
    <div class="cta-modal">
      <h3>Проверьте данные</h3>
      <div class="cta-modal__info">
        <p><strong>Имя:</strong> ${escapeHtml(name)}</p>
        <p><strong>Телефон:</strong> ${escapeHtml(phone)}</p>
      </div>
      <textarea id="ctaModalMessage" rows="4" placeholder="Напишите ваш вопрс (необязательно для заполнения)"></textarea>
      <div class="cta-modal__buttons">
        <button class="cta-modal__button cta-modal__button--cancel" id="ctaModalCancel">Отмена</button>
        <button class="cta-modal__button cta-modal__button--send" id="ctaModalSend">Отправить</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Обработка отмены
  document.getElementById('ctaModalCancel').addEventListener('click', function () {
    overlay.remove();
  });

  // Обработка отправки
  document.getElementById('ctaModalSend').addEventListener('click', async function () {
    var message = document.getElementById('ctaModalMessage').value;
    var payload = new URLSearchParams({
      name: name,
      phone: phone,
      message: message,
      form_type: formType,
      city: '',
      email: '',
      department: ''
    }).toString();

    try {
      var res = await fetch(originalForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });
      var data = await res.json();
      overlay.remove();
      if (res.ok) {
        alert('✅ Спасибо! Ваша заявка отправлена.');
        originalForm.reset();
      } else {
        alert('❌ ' + (data.error || 'Ошибка сервера'));
      }
    } catch (err) {
      overlay.remove();
      alert('❌ Произошла ошибка');
    }
  });
}

    // Показываем модальное окно
    showCtaModal(name, phone, formType, form);
  });
}


   setupFormAjax('contactForm');   // контрактная форма
   setupFormAjax('ctaForm');       // CTA в футере
});