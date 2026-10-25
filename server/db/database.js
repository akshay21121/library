const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');

let dbInstance = null;
let SQLModule = null;
let inTransaction = false;

// Ensure data folder exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function saveToDisk() {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

async function initDb() {
  if (dbInstance) return dbInstance;

  SQLModule = await initSqlJs();

  if (fs.existsSync(config.dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(config.dbPath);
      dbInstance = new SQLModule.Database(fileBuffer);
      dbInstance.run('PRAGMA foreign_keys = ON;');
      console.log('Loaded existing database from disk:', config.dbPath);
    } catch (err) {
      console.error('Failed reading existing DB, initializing new one:', err);
      dbInstance = new SQLModule.Database();
    }
  } else {
    dbInstance = new SQLModule.Database();
  }

  // Run schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    dbInstance.run(schemaSql);
    saveToDisk();
  }

  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbInstance;
}

/**
 * Execute a SELECT query and return array of objects
 */
function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Execute a SELECT query and return first object or null
 */
function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT / UPDATE / DELETE query and auto-persist
 */
function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveToDisk();
  return { changes };
}

/**
 * Execute multiple operations in a transaction
 */
function transaction(fn) {
  const db = getDb();
  inTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    inTransaction = false;
    saveToDisk();
    return result;
  } catch (err) {
    inTransaction = false;
    try {
      db.run('ROLLBACK;');
    } catch (rbErr) {
      // Transaction was already rolled back by SQLite
    }
    throw err;
  }
}

module.exports = {
  initDb,
  getDb,
  query,
  queryOne,
  run,
  transaction,
  saveToDisk,
};
