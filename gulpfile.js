const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const rename = require('gulp-rename');

// Минификация CSS
gulp.task('minify-css', () => {
   return gulp.src('public/css/*.css')
      .pipe(cleanCSS({ compatibility: 'ie8' }))
      .pipe(rename({ suffix: '.min' }))
      .pipe(gulp.dest('public/css/dist'));
});

// Минификация JS
gulp.task('minify-js', () => {
   return gulp.src('public/js/*.js')
      .pipe(uglify())
      .pipe(rename({ suffix: '.min' }))
      .pipe(gulp.dest('public/js/dist'));
});

// Объединение и минификация всех CSS в один файл
gulp.task('bundle-css', () => {
   return gulp.src([
      'public/css/main.css',
      'public/css/adaptive.css',
      'public/css/header.css',
      'public/css/footer.css',
      'public/css/catalog.css',
      'public/css/detail-news.css',
      'public/css/cookie-consent.css'
   ])
      .pipe(concat('bundle.css'))
      .pipe(cleanCSS())
      .pipe(gulp.dest('public/css/dist'));
});

// Объединение и минификация всех JS в один файл
gulp.task('bundle-js', () => {
   return gulp.src([
      'public/js/main.js',
      'public/js/catalog.js',
      'public/js/detail-product.js',
      'public/js/detail-news.js',
      'public/js/main-page.js',
      'public/js/news-public.js',
      'public/js/cookie-consent.js'
   ])
      .pipe(concat('bundle.js'))
      .pipe(uglify())
      .pipe(gulp.dest('public/js/dist'));
});

// Задача по умолчанию
gulp.task('default', gulp.parallel('minify-css', 'minify-js', 'bundle-css', 'bundle-js'));