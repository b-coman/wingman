// Filename: /src/services/updateAssessmentDetailsService.js

require('dotenv').config();
const airtableUtils = require('../lib/airtableUtils'); // Adjust the path as needed
const logger = require('../../logger'); // Adjust the path as needed

const wingmanAgentsService = require('./wingmanAgentsService');
const { stringify } = require('ajv');


// Example usage
processSignalsFromPains('38').then(() => {
    console.log('Signals processing completed successfully.');
}).catch(error => {
    console.error('An error occurred:', error);
});


// Main service function
async function processSignalsFromPains(assessmentId) {
    var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
    assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id;

    var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
    assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id;

    logger.info(`Processing signals for assessment record ID: ${assessmentId}`);
    logger.info(`Signals for assessment record ID: ${assessmentId} found in AssessmentDetails with ID: ${assessmentDetailsForSignalsId}`);
    logger.info(`Pains for assessment record ID: ${assessmentId} found in AssessmentDetails with ID: ${assessmentDetailsForPainsId}`);



    const painIDs = await extractPainIDsFromAssessmentDetails(assessmentDetailsForPainsId);
    const signalsList = await findSignalsForPains(painIDs);

    // Assuming here the interaction with AI agents
    // This should be replaced with the actual call to wingmanAgentsService and handling of the response
    const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(
        'dataAnalytics',
        'Identify Signals based on Pains',
        JSON.stringify(signalsList),
        '/endpoint' // Placeholder endpoint
    );

    // Process AI agent response (assuming it's formatted correctly for direct use)
    await createSignalAssessmentDetails(agentResponse, assessmentDetailsForSignalsId);
}



// Extract PainIDs from AssessmentDetails based on the assessmentDetailsForPainsId
async function extractPainIDsFromAssessmentDetails(assessmentDetailsForPainsId) {
    const painsData = await airtableUtils.fetchRecordsByIds('AssessmentDetails:Pains', assessmentDetailsForPainsId);
    return painsData.map(pain => pain.id);
}

// Find Signals for given Pain IDs
async function findSignalsForPains(painIDs) {
    const signalsList = [];
    for (const painId of painIDs) {
        const signalsForPain = await airtableUtils.fetchRecordsByField('painsXsignals', 'PainID', painId);
        signalsForPain.forEach(signal => {
            signalsList.push({
                SignalID: signal.fields.SignalID,
                Weight: signal.fields.Weight,
                "SignalStatement (from SignalID)": signal.fields["SignalStatement (from SignalID)"]
            });
        });
    }
    return signalsList;
}

// Process and insert confirmed Signals into Airtable
async function createSignalAssessmentDetails(agentResponseResult, assessmentDetailsForSignalsId) {
    for (const signal of agentResponseResult) {
        await airtableUtils.createRecord('AssessmentDetails:Signals', {
            AssessmentDetailsId: assessmentDetailsForSignalsId,
            SignalID: signal.SignalID,
            Reasoning: signal.reasoning,
            // Add any additional fields as needed
        });
    }
}



