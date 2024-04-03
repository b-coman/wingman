// /src/lib/assetsUtils.js
// here we keep all functions for:
// Pains, Signals, Questions

require('dotenv').config();
const airtableUtils = require('../lib/airtableUtils'); // Adjust the path as needed
const logger = require('../../logger'); // Adjust the path as needed


//find Signals record IDs for given Pain record IDs
exports.getSignalIDsForPains = async (painRecordsIDs) => {
    const signalIDsSet = new Set(); // Use a Set to ensure uniqueness
    for (const painRecordId of painRecordsIDs) {
        try {
            // Use the new utility function to fetch related signals for the current painId
            const painId = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Pains', painRecordId, 'PainID');
            const relatedSignalRecordIDs = await airtableUtils.fetchRelatedSignalsForPain(painId);

            // Add each found signal ID to the Set
            relatedSignalRecordIDs.forEach(signalId => {
                signalIDsSet.add(signalId);
            });

        } catch (error) {
            logger.error(`Error fetching signals for pain ID ${painRecordId}: ${error}`);
        }
    }
    return Array.from(signalIDsSet);
}


// find Questions record IDs for given Signal record IDs
exports.getQuestionIDsForSignals = async (signalRecordsIDs) => {
    const questionIDsSet = new Set(); // Use a Set to ensure uniqueness
    for (const signalRecordId of signalRecordsIDs) {
        try {
            // Use the new utility function to fetch related signals for the current painId
            const signalId = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Signals', signalRecordId, 'SignalID');
            const relatedQuestionRecordIDs = await airtableUtils.fetchRelatedQuestionsForSignal(signalId);

            // Add each found signal ID to the Set
            relatedQuestionRecordIDs.forEach(questionId => {
                questionIDsSet.add(questionId);
            });

        } catch (error) {
            logger.error(`Error fetching signals for pain ID ${signalRecordId}: ${error}`);
        }
    }
    return Array.from(questionIDsSet);
}
