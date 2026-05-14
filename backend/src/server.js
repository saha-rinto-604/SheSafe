const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');
const chatWsServer = require('./websocket/chatWsServer');

async function start() {
  try {
    await pool.query('SELECT 1');
    const server = http.createServer(app);
    chatWsServer.attach(server);
    server.listen(env.port, () => {
      console.log(`Backend listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error.message);
    process.exit(1);
  }
}

start();
