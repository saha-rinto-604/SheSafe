/**
 * migrate.js — Runs all SQL migration files against the configured database.
 * Execution order is determined by file sort order (alphabetical).
 * Safe to run repeatedly: all statements use IF NOT EXISTS / INSERT IGNORE.
 */

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SQL_DIR = path.join(__dirname, '..', 'sql');

// Ordered migration files
const MIGRATIONS = [
  'schema.sql',
  'migration_add_incidents.sql',
  'migration_add_locations.sql',
  'migration_add_chat.sql',
  'migration_add_otp.sql',
  'migration_add_safe_places.sql',
  'seed_medical.sql',        // idempotent — INSERT IGNORE
  'seed_incidents_demo.sql', // idempotent — WHERE NOT EXISTS
]; // add new migration files here in order

async function runSqlMigrations(conn) {
  console.log('Running SQL migrations...');
  for (const file of MIGRATIONS) {
    const filePath = path.join(SQL_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP  ${file} (not found)`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await conn.query(sql);
      console.log(`  OK    ${file}`);
    } catch (err) {
      console.error(`  FAIL  ${file}: ${err.message}`);
      throw err;
    }
  }
}

async function seedMedicalProviders(conn) {
  // Check if already seeded
  const [rows] = await conn.query('SELECT COUNT(*) AS cnt FROM medical_providers');
  if (rows[0].cnt > 0) {
    console.log('  SKIP  seed_medical (already seeded)');
    return;
  }

  console.log('  Seeding medical providers from seed_data.js...');
  // Dynamically require seed_data to reuse its data arrays
  const seedPath = path.join(__dirname, '..', 'seed_data.js');
  if (!fs.existsSync(seedPath)) {
    console.warn('  SKIP  seed_medical (seed_data.js not found)');
    return;
  }

  // seed_data.js uses the db pool — run it as a child process so it uses its own connection
  const { execSync } = require('child_process');
  try {
    execSync(`node "${seedPath}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('  OK    seed_medical');
  } catch (err) {
    console.warn('  WARN  seed_medical failed:', err.message);
  }
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    await runSqlMigrations(conn);
    await seedMedicalProviders(conn);
    console.log('All migrations and seeding complete.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
