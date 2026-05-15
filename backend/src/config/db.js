const mysql = require('mysql2/promise');
const { mysql: dbConfig } = require('./env');

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params = []) {
  console.log('[DB]', sql.replace(/\s+/g, ' ').substring(0, 80), '| params:', params.map(p => typeof p === 'string' && p.length > 20 ? p.substring(0, 20) + '...' : p));
  const [rows] = await pool.execute(sql, params);
  console.log('[DB] → returned', Array.isArray(rows) ? rows.length : 'N/A', 'rows');
  return rows;
}

module.exports = {
  pool,
  query,
};
