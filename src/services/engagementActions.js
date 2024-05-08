// /src/services/engagementActions.js

const airtableUtils = require('../lib/airtableUtils');
const hubspot = require('../integrations/hubspotUtils');


// Creates or finds a company based on given details
exports.createCompany = async (companyDetails) => {
    const { name, domain } = companyDetails;

    // check if company exists in AIrtable. If not, create it
    const companyRecordId = await airtableUtils.checkOrCreateCompany(name, domain);

    //check if company exists in Hubspot
    const hubspotCompany = await hubspot.searchCompanyByNameAndDomain(name, domain);
    var fetchedNotes = '';
    if (hubspotCompany) {
        const hobspotCompanyId = hubspotCompany[0].id;
        const hobspotCompanyName = hubspotCompany[0].properties.name;
        console.log("Company found in Hubspot.\n   Company name:", hobspotCompanyName);
        console.log("   Company ID:", hobspotCompanyId);

        const hobspotCompanyNotes = await hubspot.fetchNotesForCompany(hobspotCompanyId);

        if (hobspotCompanyNotes) {
            hobspotCompanyNotes.forEach(note => {
                fetchedNotes += note.engagement.bodyPreview + '\n';
            });
            console.log("Notes from Hubspot: \n" + fetchedNotes);   

            // put the notes in Airtable
            await airtableUtils.updateRecordField('Companies', companyRecordId, 'CompanyNotes', fetchedNotes);
        } else {
            console.log("No Hubspot notes found for this company.");
            //here it should be the logic for creating a note in Hubspot for this company
        }
        // put the Hobspot company ID in Airtable
        await airtableUtils.updateRecordField('Companies', companyRecordId, 'HubspotCompanyID', hobspotCompanyId);

    } else {
        console.log("No company data found.");
        //here it should be the logic for creating the company in Hubspot

    }
  
    return companyRecordId;
};


// Creates or finds a contact associated with a company
exports.createContact = async (contactDetails) => {
    const { firstName, lastName, email, role, companyId } = contactDetails;

    // find the roleRecordId for the role passed by the form
    const roleRecordId = await airtableUtils.findRecordIdByIdentifier('BusinessRoles', 'RoleName', role);
    const contactId = await airtableUtils.checkOrCreateContact(companyId, firstName, lastName, email, roleRecordId);
    return contactId;
};

// Creates an engagement record associated with a company and contact
exports.createEngagement = async (engagementDetails) => {
    const { companyId, contactId, sourceId, initialContext } = engagementDetails;
    // Logic to create the engagement record in Airtable
    const engagementId = await airtableUtils.createEngagement(companyId, sourceId, initialContext);
    return engagementId;
};
