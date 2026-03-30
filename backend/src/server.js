const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

async function start() {
  try {
    await pool.query('SELECT 1');
    app.listen(env.port, () => {
      console.log(`Backend listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
}

start();
