require('dotenv').config(); // Ensure environment variables are loaded
const airtableUtils = require('../src/lib/airtableUtils'); // Adjust path as necessary

async function testCheckOrCreateCompany() {
    const companyName = "Test Company";
    const companyDomain = "testcompany.com";
    
    try {
        const companyId = await airtableUtils.checkOrCreateCompany(companyName, companyDomain);
        console.log(`Company ID: ${companyId}`);
    } catch (error) {
        console.error(`Error during test: ${error}`);
    }
}

testCheckOrCreateCompany();
