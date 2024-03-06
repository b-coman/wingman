const express = require('express');
const { getConnection } = require('./database');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('DB Admin Interface is running');
});

// Test database connection
app.get('/test-db', async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query('SELECT 1 AS number');
  res.json(result.recordset);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
