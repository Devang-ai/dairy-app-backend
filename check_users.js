const db = require('./src/config/db');

async function checkUsers() {
  try {
    const [users] = await db.execute('SELECT id, username, role FROM users');
    console.log('Total Users:', users.length);
    console.log(users);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
