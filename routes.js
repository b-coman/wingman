const express = require('express');
const router = express.Router();
const { getConnection, sql } = require('./database');

// ******************Companies Routes

// Fetch all companies
router.get('/companies', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM Companies');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error retrieving companies from the database'});
  }
});

// Fetch a single company by ID
router.get('/companies/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, id)
      .query('SELECT * FROM Companies WHERE CompanyID = @CompanyID');
    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).json({message: 'Company not found'});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error retrieving company from the database'});
  }
});


// Create a company
router.post('/companies', async (req, res) => {
  const { CompanyName, Industry, Size } = req.body;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('CompanyName', sql.NVarChar, CompanyName)
      .input('Industry', sql.NVarChar, Industry)
      .input('Size', sql.NVarChar, Size)
      .query('INSERT INTO Companies (CompanyName, Industry, Size) VALUES (@CompanyName, @Industry, @Size)');
      res.status(201).json({ message: 'Company added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error adding company to the database'});
  }
});


// Update Company
router.put('/companies/:id', async (req, res) => {
  const { CompanyName, Industry, Size } = req.body;
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('CompanyName', sql.NVarChar, CompanyName)
      .input('Industry', sql.NVarChar, Industry)
      .input('Size', sql.NVarChar, Size)
      .input('CompanyID', sql.Int, id)
      .query('UPDATE Companies SET CompanyName = @CompanyName, Industry = @Industry, Size = @Size WHERE CompanyID = @CompanyID');
      
    res.json({ message: 'Company updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error updating company in the database.'});
  }
});

// Delete Company
router.delete('/companies/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('CompanyID', sql.Int, id)
      .query('DELETE FROM Companies WHERE CompanyID = @CompanyID');

    res.json({ message: 'Company deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error deleting company from the database.'});
  }
});


// ************* Contacts Routes

// Fetch all contacts
router.get('/contacts', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM Contacts');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error retrieving contacts from the database'});
  }
});

// Create a contact
router.post('/contacts', async (req, res) => {
  const { CompanyID, FirstName, LastName, Email, RoleID, PoC } = req.body;
  try {
      const pool = await getConnection();
      await pool.request()
        .input('CompanyID', sql.Int, CompanyID)
        .input('FirstName', sql.NVarChar, FirstName)
        .input('LastName', sql.NVarChar, LastName)
        .input('Email', sql.NVarChar, Email)
        .input('RoleID', sql.NVarChar, RoleID)
        .input('PoC', sql.Char, PoC)
        .query('INSERT INTO Contacts (CompanyID, FirstName, LastName, Email, RoleID, PoC) VALUES (@CompanyID, @FirstName, @LastName, @Email, @RoleID, @PoC)');
      res.status(201).json({ message: 'Contact added successfully' });
  } catch (err) {
      console.error(err);
      res.status(500).json({message: 'Error adding contact to the database'});
  }
});


// Update Contact
router.put('/contacts/:id', async (req, res) => {
  const { CompanyID, FirstName, LastName, Email, RoleID, PoC } = req.body;
  const { id } = req.params;
  try {
      const pool = await getConnection();
      await pool.request()
        .input('CompanyID', sql.Int, CompanyID)
        .input('FirstName', sql.NVarChar, FirstName)
        .input('LastName', sql.NVarChar, LastName)
        .input('Email', sql.NVarChar, Email)
        .input('RoleID', sql.NVarChar, RoleID)
        .input('PoC', sql.Char, PoC)
        .input('ContactID', sql.Int, id)
        .query('UPDATE Contacts SET CompanyID = @CompanyID, FirstName = @FirstName, LastName = @LastName, Email = @Email, RoleID = @RoleID, PoC = @PoC WHERE ContactID = @ContactID');
      res.json({ message: 'Contact updated successfully.' });
  } catch (err) {
      console.error(err);
      res.status(500).json({message: 'Error updating contact in the database.'});
  }
});


// Delete Contact
router.delete('/contacts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await getConnection();
    await pool.request()
      .input('ContactID', sql.Int, id)
      .query('DELETE FROM Contacts WHERE ContactID = @ContactID');

    res.json({ message: 'Contact deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Error deleting contact from the database.'});
  }
});

module.exports = router;

