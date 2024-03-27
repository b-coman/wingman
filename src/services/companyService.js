// Filename: /src/services/companyService.js

const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger'); 

/**
 * Fetches company details associated with a given engagement record ID.
 * 
 * @param {String} engagementRecordId The record ID of the engagement.
 * @returns {Promise<Object>} An object containing company details.
 */

exports.fetchCompanyDetailsFromEngagement = async (engagementRecordId) => {
    try {
        // Fetch the CompanyID linked with the engagement
        var companyRecordId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'CompanyID');
        //logger.info(`CompanyRecordID: value = ${companyRecordId}, type = ${typeof companyRecordId}`);
        
        // Ensure companyRecordId is correctly extracted in case it's returned as an array
        companyRecordId = Array.isArray(companyRecordId) ? companyRecordId[0] : companyRecordId;
        //logger.info(`CompanyID: value = ${companyRecordId}, type = ${typeof companyRecordId}`);

        // Fetch company name and domain using the CompanyID
        const companyName = await airtableUtils.findFieldValueByRecordId('Companies', companyRecordId, 'CompanyName');
        const companyDomain = await airtableUtils.findFieldValueByRecordId('Companies', companyRecordId, 'CompanyDomain');
        const contactFullName = await airtableUtils.findFieldValueByRecordId('Companies', companyRecordId, '*ContactFullName (from *Contacts)');

        // Return the company details as an object
        return { companyRecordId, companyName, companyDomain, contactFullName };
    } catch (error) {
        logger.error(`Error fetching company details from engagement: ${error}`);
        throw error; // Rethrow the error for handling by the caller
    }
};
