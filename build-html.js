const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, 'public');
const cssFiles = [
   'main', 'adaptive', 'header', 'footer', 'catalog', 'detail-news',
   'cookie-consent', 'about', 'contract', 'partners', 'production',
   'main-content', 'privacy', 'tinymce-content'
];

const jsFiles = [
   'main', 'catalog', 'detail-product', 'detail-news', 'main-page',
   'news-public', 'cookie-consent'
];

fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).forEach(filename => {
   const filepath = path.join(htmlDir, filename);
   let html = fs.readFileSync(filepath, 'utf8');

   // Заменяем все CSS на bundle.css
   cssFiles.forEach(name => {
      html = html.replace(new RegExp(`<link[^>]*href="/css/${name}\\.css"[^>]*>`, 'g'), '');
   });
   html = html.replace('</head>', '<link rel="stylesheet" href="/css/dist/bundle.css">\n</head>');

   // Заменяем все JS на bundle.js
   jsFiles.forEach(name => {
      html = html.replace(new RegExp(`<script[^>]*src="/js/${name}\\.js"[^>]*></script>`, 'g'), '');
   });
   html = html.replace('</body>', '<script src="/js/dist/bundle.js"></script>\n</body>');

   fs.writeFileSync(filepath, html);
   console.log(`Обновлён: ${filename}`);
});