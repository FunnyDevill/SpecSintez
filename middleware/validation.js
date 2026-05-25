const pool = require('../db');


function requireFields(...fields) {
  return (req, res, next) => {
    const errors = [];
    fields.forEach(field => {
      const value = req.body[field];
      if (value === undefined || value === null || value.trim() === '') {
        errors.push(`Поле "${field}" обязательно для заполнения`);
      } else if (field === 'slug' && !/^[a-z0-9\-]+$/.test(value.trim())) {
        errors.push('Slug может содержать только латинские буквы, цифры и дефисы');
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
    if (!req.body[field] || req.body[field].trim() === '') {
      // Нет смысла проверять уникальность пустого slug
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
        const errorMsg = `${entity === 'products' ? 'Товар' : entity === 'categories' ? 'Категория' : entity === 'news' ? 'Новость' : 'Запись'} с таким slug уже существует`;
        req.validationErrors = [...(req.validationErrors || []), errorMsg];
      }
    } catch (err) {
      return next(err);
    }
    next();
  };
}

module.exports = { requireFields, checkSlugUnique };