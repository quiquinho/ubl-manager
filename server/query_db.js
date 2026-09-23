const mysql = require('mysql2/promise');

async function query() {
  const config = {
    host: process.env.DB_HOST || '192.168.1.61',
    user: process.env.DB_USER || 'cynthia_user',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cynthia_app',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  };

  const conn = await mysql.createConnection(config);
  try {
    const [tables] = await conn.query("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = 'cynthia_app'");
    const [roles] = await conn.query('SELECT * FROM roles ORDER BY id');
    const [users] = await conn.query('SELECT id, login, nombre, apellidos, role_id, password_base64, password_changed_at FROM users LIMIT 100');
    const [menu] = await conn.query('SELECT * FROM menu_page ORDER BY id');
    const [role_menu] = await conn.query('SELECT rm.role_id, mp.id AS menu_id, mp.title FROM role_menu rm JOIN menu_page mp ON rm.menu_id = mp.id ORDER BY rm.role_id, mp.id');
    const [menu_for_100] = await conn.query("SELECT mp.id, mp.title, mp.path, mp.parent_id FROM menu_page mp JOIN role_menu rm ON mp.id = rm.menu_id WHERE rm.role_id = 100 ORDER BY mp.id");

    console.log(JSON.stringify({ tables, roles, users, menu, role_menu, menu_for_100 }, null, 2));
  } finally {
    await conn.end();
  }
}

query().catch(err => {
  console.error('Query error:', err);
  process.exit(1);
});
