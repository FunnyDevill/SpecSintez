const pool = require('../db');

function requireFields(...fields) {
  return (req, res, next) => {
    const errors = [];
    fields.forEach(field => {
      const value = req.body[field];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        // Пропускаем проверку slug — он генерируется автоматически
        if (field === 'slug') return;
        
        const fieldNames = {
          name: 'Название',
          title: 'Заголовок',
          email: 'Email',
          phone: 'Телефон',
          message: 'Сообщение'
        };
        const label = fieldNames[field] || field;
        errors.push(`Поле "${label}" обязательно для заполнения`);
      } else if (field === 'slug' && value && value.trim() !== '') {
        // Проверяем slug только если он указан вручную
        if (!/^[a-z0-9\-]+$/.test(value.trim())) {
          errors.push('Slug может содержать только латинские буквы, цифры и дефисы');
        }
      }
    });
    if (errors.length > 0) {
      req.validationErrors = [...(req.validationErrors || []), ...errors];
    }
    next();
  };
}

function checkSlugUnique(entity, field = 'slug', excludeIdField = null) {
  return async (req, res, next) => {
    // Пропускаем проверку если slug пустой (будет сгенерирован автоматически)
    if (!req.body[field] || req.body[field].trim() === '') {
      return next();
    }
    
    const slug = req.body[field].trim();
    let query;
    let params;
    
    if (excludeIdField && req.params[excludeIdField]) {
      query = `SELECT id FROM ${entity} WHERE ${field} = $1 AND id != $2`;
      params = [slug, req.params[excludeIdField]];
    } else {
      query = `SELECT id FROM ${entity} WHERE ${field} = $1`;
      params = [slug];
    }
    
    try {
      const result = await pool.query(query, params);
      if (result.rows.length > 0) {
        const entityNames = {
          products: 'Товар',
          categories: 'Категория',
          news: 'Новость',
          package_types: 'Тип упаковки'
        };
        const entityName = entityNames[entity] || 'Запись';
        const errorMsg = `${entityName} с таким slug уже существует`;
        req.validationErrors = [...(req.validationErrors || []), errorMsg];
      }
    } catch (err) {
      return next(err);
    }
    next();
  };
}


function requireDate(field, errorMessage = 'Дата публикации обязательна') {
  return (req, res, next) => {
    const value = req.body[field];
    if (!value || value.trim() === '') {
      req.validationErrors = [...(req.validationErrors || []), errorMessage];
    }
    next();
  };
}

module.exports = { requireFields, checkSlugUnique, requireDate };
