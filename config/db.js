const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Directorio de datos (fuera del código para persistencia)
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'techstore.db');
const db = new Database(dbPath);

// Habilitar WAL para mejor rendimiento y claves foráneas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('✅ SQLite conectado:', dbPath);

// ── Wrapper para compatibilidad con la API async de mysql2 ──
// Las rutas usan: const [rows] = await db.query(...)
// Aquí lo convertimos a síncrono con la misma firma

const pool = {
  query: (sql, params = []) => {
    try {
      const stmt = db.prepare(sql);
      // Detectar si es SELECT o DML
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
        const rows = stmt.all(...params);
        return Promise.resolve([rows]);
      } else {
        const info = stmt.run(...params);
        // Emular el ResultSetHeader de mysql2
        return Promise.resolve([{ insertId: info.lastInsertRowid, affectedRows: info.changes }]);
      }
    } catch (e) {
      return Promise.reject(e);
    }
  },

  // Para transacciones (ventas y compras usan conn.beginTransaction())
  getConnection: () => {
    const conn = {
      _inTransaction: false,

      query: (sql, params = []) => pool.query(sql, params),

      beginTransaction: () => {
        db.prepare('BEGIN').run();
        conn._inTransaction = true;
        return Promise.resolve();
      },
      commit: () => {
        if (conn._inTransaction) { db.prepare('COMMIT').run(); conn._inTransaction = false; }
        return Promise.resolve();
      },
      rollback: () => {
        if (conn._inTransaction) { db.prepare('ROLLBACK').run(); conn._inTransaction = false; }
        return Promise.resolve();
      },
      release: () => {}
    };
    return Promise.resolve(conn);
  },

  // Acceso al objeto db nativo por si se necesita
  _db: db
};

module.exports = pool;
