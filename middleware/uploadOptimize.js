const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

module.exports = async function optimizeAndReplace(req, res, next) {
   if (!req.file && !req.files) return next();
   const files = req.files?.length ? req.files : [req.file].filter(Boolean);

   try {
      for (const file of files) {
         const inputPath = file.path;
         const outputPath = inputPath;
         const tempPath = inputPath + '.tmp';

         const ext = path.extname(file.originalname).toLowerCase();
         let pipeline = sharp(inputPath).resize({ width: 1200, withoutEnlargement: true });

         // Выбираем формат на основе исходного файла
         if (ext === '.png') {
            pipeline = pipeline.png({ quality: 85 });
         } else if (ext === '.webp') {
            pipeline = pipeline.webp({ quality: 85 });
         } else {
            // JPEG по умолчанию
            pipeline = pipeline.jpeg({ quality: 85, progressive: true });
         }

         await pipeline.toFile(tempPath);

         fs.unlinkSync(inputPath);
         fs.renameSync(tempPath, outputPath);
      }
      next();
   } catch (err) {
      console.error('Ошибка оптимизации изображения:', err);
      next();
   }
};