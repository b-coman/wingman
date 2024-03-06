const sql = require('mssql');

const config = {
  user: 'wingman',
  password: 'vodgek-jUdge1-qohhyz',
  server: 'wingman-server.database.windows.net',
  database: 'wingman-db',
  options: {
    encrypt: true, // Necessary for Azure SQL
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
