// /src/services/engagementPromptsService.js

const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger'); 

/**
 * Finds an approved prompt record from a list of prompt record IDs.
 * @param {Array} promptRecordIds Array of engagement prompt record IDs.
 * @returns {String|Null} The record ID of the approved prompt, or null.
 */
async function findApprovedPromptRecord(promptRecordIds) {

    const tableName = 'EngagementPrompts';
    const fieldName = 'EngagementPromptStatus';
    const approvedStatus = 'approved';
    let approvedPrompts = [];

    for (const recordId of promptRecordIds) {
        try {
            const promptStatus = await airtableUtils.findFieldValueByRecordId(tableName, recordId, fieldName);

            if (promptStatus === approvedStatus) {
                approvedPrompts.push(recordId);
            }
        } catch (error) {
            logger.error(`Error checking prompt status for record ID ${recordId}:`, error);
        }
    }

    if (approvedPrompts.length === 0) {
        logger.warn("No approved prompts found.");
        return null;
    } else if (approvedPrompts.length > 1) {
        logger.warn("Multiple approved prompts found.");
        //return approvedPrompts; // Or handle as needed
    } else {
        //logger.info(`Approved prompt found: ${approvedPrompts[0]}`);
        return approvedPrompts[0];
    }
}

module.exports = { findApprovedPromptRecord };
