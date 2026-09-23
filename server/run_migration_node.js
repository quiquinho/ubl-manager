const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const sqlPath = path.resolve(__dirname, '..', 'db', 'init.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('No se encuentra db/init.sql en el proyecto.');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' });

  const config = {
    host: process.env.DB_HOST || '192.168.1.61',
    user: process.env.DB_USER || 'cynthia_user',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cynthia_app',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    multipleStatements: true,
  };

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Conectado a la BD, ejecutando migración...');
    const [results] = await connection.query(sql);
    const [columns] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'players'
         AND column_name = 'photo_blob'`
    );
    if (columns[0].count === 0) {
      await connection.query('ALTER TABLE players ADD COLUMN photo_blob MEDIUMBLOB');
      console.log('Columna players.photo_blob creada.');
    }
    const [matchColumns] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'matches'
         AND column_name = 'advance_minutes'`
    );
    if (matchColumns[0].count === 0) {
      await connection.query('ALTER TABLE matches ADD COLUMN advance_minutes INT NOT NULL DEFAULT 30');
      console.log('Columna matches.advance_minutes creada.');
    }
    console.log('Migración ejecutada. Resultado:', results);
  } catch (err) {
    console.error('Error al ejecutar la migración:', err.message || err);
    process.exitCode = 2;
  } finally {
    if (connection) await connection.end();
  }
}

run();
