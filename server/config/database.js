require('dotenv').config();
const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH;

if (!dbPath) {
  throw new Error('DATABASE_PATH not set in .env file');
}

let db;

try {
  db = new Database(dbPath, { readonly: true });
  console.log('✅ Connected to SQLite database at:', dbPath);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.error('Database path attempted:', dbPath);
  throw error;
}

module.exports = db;