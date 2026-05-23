const { Pool } = require('pg');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const pool = new Pool(
  isTest
    ? {
        connectionString: process.env.TEST_DATABASE_URL,
        // или по частям, если используете отдельные переменные
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'specsintez',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
      }
);

module.exports = pool;