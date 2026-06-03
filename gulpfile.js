const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');

// CSS-бандл
gulp.task('bundle-css', () => {
   return gulp.src([
      'public/css/main.css',
      'public/css/layout.css',
      'public/css/catalog.css',
      'public/css/news-detail.css',
      'public/css/pages/about.css',
      'public/css/pages/contract.css',
      'public/css/pages/partners.css',
      'public/css/pages/production.css',
      'public/css/pages/privacy.css',
      'public/css/adaptive.css',
      'public/css/tinymce-content.css'
   ])
      .pipe(concat('bundle.css'))
      .pipe(cleanCSS({ compatibility: 'ie8' }))
      .pipe(gulp.dest('public/css/dist'));
});

// JS-бандл
gulp.task('bundle-js', () => {
   return gulp.src([
      'public/js/main.js',
      'public/js/catalog.js',
      'public/js/detail-news.js',
      'public/js/main-page.js',
      'public/js/news-public.js',
      'public/js/cookie-consent.js'
   ])
      .pipe(concat('bundle.js'))
      .pipe(uglify())
      .pipe(gulp.dest('public/js/dist'));
});

gulp.task('default', gulp.parallel('bundle-css', 'bundle-js'));