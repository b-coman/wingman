// /src/services/engagementActions.js

const airtableUtils = require('../lib/airtableUtils');

// Creates or finds a company based on given details
exports.createCompany = async (companyDetails) => {
    const { name, domain } = companyDetails;
    // Logic to check or create the company in Airtable
    const companyId = await airtableUtils.checkOrCreateCompany(name, domain);
    return companyId;
};

// Creates or finds a contact associated with a company
exports.createContact = async (contactDetails) => {
    const { firstName, lastName, email, role, companyId } = contactDetails;
    // Logic to check or create the contact in Airtable
    const contactId = await airtableUtils.checkOrCreateContact(companyId, firstName, lastName, email, role);
    return contactId;
};

// Creates an engagement record associated with a company and contact
exports.createEngagement = async (engagementDetails) => {
    const { companyId, contactId, sourceId, initialContext } = engagementDetails;
    // Logic to create the engagement record in Airtable
    const engagementId = await airtableUtils.createEngagement(companyId, sourceId, initialContext);
    return engagementId;
};
