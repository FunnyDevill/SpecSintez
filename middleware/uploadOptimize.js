// middleware/uploadOptimize.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

module.exports = async function optimizeAndReplace(req, res, next) {
  if (!req.file && !req.files) return next();
  const files = req.files?.length ? req.files : [req.file].filter(Boolean);
  try {
    for (const file of files) {
      // file.path — это абсолютный путь от multer (например, C:\...\public\uploads\имя.png)
      const inputPath = file.path;
      const outputPath = inputPath; // перезаписываем оригинал
      const tempPath = inputPath + '.tmp';

      await sharp(inputPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .png({ quality: 85 })
        .webp({ quality: 85 })
        .toFile(tempPath);

      fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, outputPath);
    }
    next();
  } catch (err) {
    console.error('Ошибка оптимизации изображения:', err);
    // Не блокируем запрос
    next();
  }
};