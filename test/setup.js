const pool = require("../db");

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      parent_id INTEGER REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      description TEXT,
      image_url TEXT,
      icon_svg TEXT
    );
    
    CREATE TABLE IF NOT EXISTS directions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0,
      image_url TEXT
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      excerpt TEXT,
      description TEXT,
      properties TEXT,
      image_url TEXT,
      category_id INTEGER REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true
    );
    
    CREATE TABLE IF NOT EXISTS product_categories (
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, category_id)
    );
    
    CREATE TABLE IF NOT EXISTS product_directions (
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      direction_id INTEGER REFERENCES directions(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, direction_id)
    );
    
    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      is_main BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS product_options (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS package_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      icon_url TEXT,
      sort_order INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS product_package_types (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      package_type_id INTEGER REFERENCES package_types(id) ON DELETE CASCADE,
      volume VARCHAR(50),
      UNIQUE(product_id, package_type_id)
    );
    
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      published_at DATE,
      image_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      is_active BOOLEAN DEFAULT true,
      is_hero BOOLEAN DEFAULT false
    );
  `);
};

const clearTables = async () => {
  if (process.env.NODE_ENV !== "test") {
    console.error("Попытка очистить таблицы в не-тестовом окружении!");
    throw new Error("clearTables можно вызывать только в тестовом режиме");
  }

  await pool.query(`
    TRUNCATE TABLE 
      product_categories, 
      product_directions,
      product_images, 
      product_options,
      product_package_types, 
      package_types, 
      products, 
      categories,
      directions,
      news 
    RESTART IDENTITY CASCADE
  `);
};

module.exports = { createTables, clearTables };
