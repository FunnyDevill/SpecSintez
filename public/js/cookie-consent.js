// cookie-consent.js
(function () {
   if (localStorage.getItem('cookieConsent')) return;

   var overlay = document.createElement('div');
   overlay.className = 'cookie-overlay';
   overlay.innerHTML = `
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
  `;
   document.body.appendChild(overlay);

   function hideBanner() {
      overlay.remove();
   }

   document.getElementById('cookie-accept').addEventListener('click', function () {
      localStorage.setItem('cookieConsent', 'true');
      hideBanner();
   });

   document.getElementById('cookie-decline').addEventListener('click', function () {
      localStorage.setItem('cookieConsent', 'false');
      hideBanner();
   });
})();