// file name:  /src/services/peopleService.js

const airtableUtils = require('../lib/airtableUtils'); 
const logger = require('../../logger'); 

/**
 * Fetches details for a given recordID, based on the flag indicating whether it's a user or a contact.
 * @param {String} recordID - The ID of the record to fetch.
 * @param {String} flag - Indicates whether the recordID is for a 'user' or a 'contact'.
 * @returns {Promise<Object>} - A promise that resolves to the details of the record.
 */
exports.fetchPeopleDetails = async (recordID, flag) => {
    try {
        // Determine the table based on the flag
        const tableName = flag === 'user' ? 'Users' : 'Contacts';

        // Fetch details from the specified table
        const recordDetails = await airtableUtils.getFieldsForRecordById(tableName, recordID);

        if (!recordDetails) {
            throw new Error(`No record found with ID ${recordID} in ${tableName}`);
        }

        // Check for a role ID in the user or contact record, assuming there's a field for it. Adjust field name as needed.
        const roleID = recordDetails.ContactRoleID || null;
        
        if (roleID) {
            // Fetch RoleName and RoleDescription from the BusinessRoles table based on roleID
            const roleDetails = await airtableUtils.getFieldsForRecordById('BusinessRoles', roleID, ['RoleName', 'RoleDescription']);
            
            if (roleDetails) {
                // Append RoleName and RoleDescription to the response object
                recordDetails.RoleName = roleDetails.RoleName;
                recordDetails.RoleDescription = roleDetails.RoleDescription;
            }
        }

        return recordDetails;
    } catch (error) {
        logger.error(`Error fetching details for ${flag} with ID ${recordID}:`, error);
        throw error;
    }
}


/**
 * Finds the Record ID of the primary contact associated with a given EngagementRecordID.
 * 
 * @param {String} engagementRecordId - The Record ID of the engagement for which to find the primary contact.
 * @returns {Promise<String>} A promise that resolves with the Record ID of the primary contact,
 *                            or rejects with an error if no primary contact can be found or if any lookup fails.
 * @throws {Error} When no company is found for the given EngagementRecordID, when no contacts are associated
 *                 with the found company, or when a primary contact cannot be identified among the contacts.
 */
exports.findPrimaryContactID = async (engagementRecordId) => {
    try {

        const companyRecordId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'CompanyID');
        if (!companyRecordId) throw new Error(`Company not found for EngagementRecordID: ${engagementRecordId}`);

        // Fetch the list of contact record IDs from the company record
        const contactRecordIDs = await airtableUtils.findFieldValueByRecordId('Companies', companyRecordId, '*Contacts');
        
        if (!contactRecordIDs || contactRecordIDs.length === 0) throw new Error(`Contacts not found for CompanyRecordID: ${companyRecordId}`);

        // Iterate over contact record IDs to find the primary contact
        for (let contactRecordID of contactRecordIDs) {
            const contactType = await airtableUtils.findFieldValueByRecordId('Contacts', contactRecordID, 'ContactType');
            if (contactType === 'primary') {
                return contactRecordID; // Return the ID of the primary contact
            }
        }
        
        throw new Error(`Primary contact not found for CompanyRecordID: ${companyRecordId}`);
    } catch (error) {
        console.error(`Error finding primary contact: ${error.message}`);
        throw error; // Rethrow the error or handle it as per your error handling strategy
    }
}
