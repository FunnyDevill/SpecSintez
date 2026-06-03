// ========== ГЛОБАЛЬНОЕ ПРОСТРАНСТВО ИМЁН ==========
window.App = {
  escapeHtml: function (str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, function (m) {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      return m;
    });
  },

  formatDate: function (isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  },

  getCategoryIconHtml: function (category) {
    const defaultIcon = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
    </svg>`;
    if (category && category.icon_svg && category.icon_svg.trim()) {
      return category.icon_svg;
    }
    return defaultIcon;
  },
};

// Для обратной совместимости (пока не обновлены все файлы)
window.escapeHtml = window.App.escapeHtml;
window.formatDate = window.App.formatDate;
window.getCategoryIconHtml = window.App.getCategoryIconHtml;

// ========== ПАРАЛЛАКС HERO ==========
document.addEventListener("DOMContentLoaded", function () {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  window.addEventListener("scroll", function () {
    const scrolled = window.pageYOffset;
    const videoWrapper = hero.querySelector(".hero__video-wrapper");
    const overlay = hero.querySelector(".hero__overlay");
    const content = hero.querySelector(".hero__content");

    if (videoWrapper) {
      videoWrapper.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
    if (overlay) {
      overlay.style.opacity = 0.5 + scrolled * 0.001;
    }
    if (content) {
      content.style.transform = `translateY(${scrolled * 0.2}px)`;
      content.style.opacity = 1 - scrolled * 0.003;
    }
  });
});

// ========== АНИМАЦИЯ ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ ==========
document.addEventListener("DOMContentLoaded", function () {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document
    .querySelectorAll(
      ".industry-card, .product-card, .news-card, .advantage-card, .about-card, .scheme-step",
    )
    .forEach((el) => {
      el.classList.add("animate-hidden");
      observer.observe(el);
    });
});

// ========== АНИМАЦИЯ СЧЁТЧИКОВ ==========
document.addEventListener("DOMContentLoaded", function () {
  const stats = document.querySelectorAll(".stat-number");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target;
          const value = parseInt(target.textContent);
          animateValue(target, 0, value, 1500);
          observer.unobserve(target);
        }
      });
    },
    { threshold: 0.5 },
  );

  stats.forEach((stat) => observer.observe(stat));
});

function animateValue(element, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const current = Math.floor(progress * (end - start) + start);
    element.textContent = current + "+";
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// ========== АКТИВНЫЙ ПУНКТ МЕНЮ ==========
document.querySelectorAll(".main-nav__link").forEach((link) => {
  if (
    link.href === window.location.href ||
    window.location.pathname.includes(link.getAttribute("href"))
  ) {
    link.classList.add("active");
  }
});

// ========== БУРГЕР-МЕНЮ ==========
document.addEventListener("DOMContentLoaded", function () {
  const burger = document.getElementById("burgerToggle");
  const nav = document.getElementById("mainNav");
  if (!burger || !nav) return;

  function closeMenu() {
    burger.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
    document.body.style.overflow = "";
  }

  function openMenu() {
    burger.setAttribute("aria-expanded", "true");
    nav.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  burger.addEventListener("click", function (e) {
    e.stopPropagation();
    const expanded = burger.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  });

  nav.querySelectorAll(".main-nav__link").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      closeMenu();
      burger.focus();
    }
  });

  document.addEventListener("click", function (e) {
    if (
      !nav.contains(e.target) &&
      !burger.contains(e.target) &&
      nav.classList.contains("open")
    ) {
      closeMenu();
    }
  });
});

// ========== КНОПКА "НАВЕРХ" ==========
document.addEventListener("DOMContentLoaded", function () {
  const scrollBtn = document.getElementById("scrollToTop");
  if (!scrollBtn) return;

  window.addEventListener("scroll", function () {
    if (window.scrollY > 500) {
      scrollBtn.classList.add("visible");
    } else {
      scrollBtn.classList.remove("visible");
    }
  });

  scrollBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// ========== ОБРАБОТКА ФОРМ ==========
document.addEventListener("DOMContentLoaded", function () {
  function setupFormAjax(formId) {
    var form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var formData = new FormData(form);

      var name = formData.get("name") || "";
      var phone = formData.get("phone") || "";
      var formType = formData.get("form_type") || "cta";
      var email = formData.get("email") || "";
      var city = formData.get("city") || "";
      var message = formData.get("message") || "";
      var department = formData.get("department") || "";

      var messageDiv = document.getElementById("form-message");

      // Для контрактной формы
      if (formId === "contactForm") {
        var payload = new URLSearchParams({
          name: name,
          phone: phone,
          email: email,
          city: city,
          message: message,
          department: department,
          form_type: formType,
        }).toString();

        try {
          var res = await fetch(form.action, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: payload,
          });
          var data = await res.json();

          if (messageDiv) {
            messageDiv.style.display = "block";
            if (res.ok) {
              messageDiv.style.background = "#d4edda";
              messageDiv.style.color = "#155724";
              messageDiv.textContent =
                "✅ Спасибо! Ваша заявка отправлена. Мы свяжемся с вами в ближайшее время.";
              form.reset();
            } else {
              messageDiv.style.background = "#f8d7da";
              messageDiv.style.color = "#721c24";
              messageDiv.textContent = "❌ " + (data.error || "Ошибка сервера");
            }
          }
          return;
        } catch (err) {
          if (messageDiv) {
            messageDiv.style.display = "block";
            messageDiv.style.background = "#f8d7da";
            messageDiv.style.color = "#721c24";
            messageDiv.textContent = "❌ Произошла ошибка";
          }
          return;
        }
      }

      // Для CTA формы — показываем модальное окно
      showCtaModal(name, phone, formType, form);
    });
  }

  function showCtaModal(name, phone, formType, originalForm) {
    var oldOverlay = document.querySelector(".cta-modal-overlay");
    if (oldOverlay) oldOverlay.remove();

    var overlay = document.createElement("div");
    overlay.className = "cta-modal-overlay";
    overlay.innerHTML = `
         <div class="cta-modal">
           <h3>Проверьте данные</h3>
           <div class="cta-modal__info">
             <p><strong>Имя:</strong> ${window.App.escapeHtml(name)}</p>
             <p><strong>Телефон:</strong> ${window.App.escapeHtml(phone)}</p>
           </div>
           <textarea id="ctaModalMessage" rows="4" placeholder="Напишите ваш вопрос (необязательно для заполнения)"></textarea>
           <div class="cta-modal__buttons">
             <button class="cta-modal__button cta-modal__button--cancel" id="ctaModalCancel">Отмена</button>
             <button class="cta-modal__button cta-modal__button--send" id="ctaModalSend">Отправить</button>
           </div>
         </div>
      `;
    document.body.appendChild(overlay);

    document
      .getElementById("ctaModalCancel")
      .addEventListener("click", function () {
        overlay.remove();
      });

    document
      .getElementById("ctaModalSend")
      .addEventListener("click", async function () {
        var modalMessage = document.getElementById("ctaModalMessage").value;
        var payload = new URLSearchParams({
          name: name,
          phone: phone,
          message: modalMessage,
          form_type: formType,
          city: "",
          email: "",
          department: "",
        }).toString();

        try {
          var res = await fetch(originalForm.action, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: payload,
          });
          var data = await res.json();
          overlay.remove();
          if (res.ok) {
            alert("✅ Спасибо! Ваша заявка отправлена.");
            originalForm.reset();
          } else {
            alert("❌ " + (data.error || "Ошибка сервера"));
          }
        } catch (err) {
          overlay.remove();
          alert("❌ Произошла ошибка");
        }
      });
  }

  setupFormAjax("contactForm");
  setupFormAjax("ctaForm");
});
