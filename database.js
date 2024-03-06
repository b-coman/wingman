const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    enableArithAbort: true
  }
};

async function getConnection() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to the SQL Database successfully');
    return pool;
  } catch (err) {
    console.error('SQL Database connection error', err);
  }
}

module.exports = {
  getConnection,
  sql
};
