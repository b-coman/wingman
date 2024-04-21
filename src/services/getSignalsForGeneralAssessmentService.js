// Filename: /src/services/getSignalsForGeneralAssessmentService.js

require('dotenv').config();
const { appConfig } = require('../../config');
const airtableUtils = require('../lib/airtableUtils');
const assetsUtils = require('../lib/knowledgeModelUtils');
const logger = require('../../logger');
const logFlowTracking = require('./flowTrackingService');
const wingmanAgentsService = require('./wingmanAgentsService');
const replacePlaceholders = require('./replacePlaceholders');
const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');


// this will select all signals related to pains already approved for an assessment, and then validate them with an agent
async function processSignalsFromPains(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {
        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where signals are stored
        var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
        assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id;

        // find the record ID in table AssessmentDetails where pains are stored
        var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
        assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id;

        // find the record ID in table AssessmentDetails where initial research is stored
        var assessmentDetailsForReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
        assessmentDetailsForReportId = assessmentDetailsForReportId[0].id

        // get the pain IDs from AssessmentDetails
        const painRecordIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'AssessmentDetails:Pains');

        // get the signal record IDs that are connected to the pain IDs indentified before
        const signalRecordIDs = await assetsUtils.getSignalIDsForPains(painRecordIDs);

        //construct the object that store details about pains
        var painsDescription = ""; var counter = 1;
        for (const painRecordId of painRecordIDs) {
            try {
                const painData = await airtableUtils.getFieldsForRecordById('Pains', painRecordId);
                const painStatement = painData['PainStatement (from PainID)'];        
                painsDescription += `Pain point candidate ${counter}: ${painStatement}; \n`;
                counter++;  
            } catch (error) {
                logger.error(`Error fetching data for pain record ID ${painRecordId}: ${error}`);
            }
        }
        // seriailze pains data
        var jsonPainDescription = JSON.stringify(painsDescription);

        //construct the object that store details about signals
        const signalsData = [];
        for (const signalRecordId of signalRecordIDs) {
            try {
                const signalData = await airtableUtils.getFieldsForRecordById('Signals', signalRecordId);
                // Extract only the necessary fields
                const filteredSignalData = {
                    signalSKU: signalData['SignalSKU'],
                    signalStatement: signalData['SignalStatement'] || 'No signal here',
                    signalDescription: signalData['SignalDescription'] || ''
                };
                signalsData.push(filteredSignalData);
            } catch (error) {
                logger.error(`Error fetching data for signal record ID ${signalRecordId}: ${error}`);
            }
        }
        // serialiize signals data
        var jsonSignalsData = JSON.stringify(signalsData);
        

        //prepare the agent call, the additional details needed
        const companyName = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyName (from CompanyID) (from assignedToEngagement)');
        var companyRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyID (from assignedToEngagement)');
        companyRecordId = companyRecordId[0];
        const rawReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForReportId, 'Value');
        // seriailze raw report
        const jsonRawReport = JSON.stringify(rawReport);

        const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'identify_signals');
        const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
        const crewName = crewDetails.SquadName;
        const crewJson = crewDetails.SquadJSON;

        //replace placeholders in the payload
        var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
            COMPANY: companyName,
            INITIAL_RESEARCH: jsonRawReport.replace(/"/g, '\\"'),
            PAINS_LIST: jsonPainDescription.replace(/"/g, '\\"'),
            SIGNALS_LIST: jsonSignalsData.replace(/"/g, '\\"')
        });

        logger.info(`Agent payload: \n${crewPayload}`);
        logger.warn("Now calling agent...");

        // Start tracking the agent activity
        const runID = await airtableUtils.createAgentActivityRecord(companyRecordId, crewName, crewPayload);
        logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

        // Call the agent army with the payload // schema path is used to validate the response
        const schemaPath = '../../schema/crewAiResponseSchema_signals.json';
        const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload, schemaPath);

        // extract the signals from the response
        var agentResponseResult = agentResponse.result;
        logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

        // Complete tracking the agent activity with the response
        await airtableUtils.updateAgentActivityRecord(runID, JSON.stringify(agentResponse, null, 4));

        // insert the signals identified by the agent into the AssessmentDetails:Signals table
        await airtableUtils.createSignalAssessmentDetails(agentResponseResult, assessmentDetailsForSignalsId, runID);

        // Complete tracking the agent activity with the response
        await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

        // make the update to AssessmentDetails with the agent result, and the status
        agentResponseResult = JSON.stringify(agentResponseResult)
        const assessmentDetailsStatus = appConfig.signalRequireApproval ? 'pending' : 'approved'; // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approava;
        await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessSignalsId, assessmentDetailsStatus);

        // update the status for the current assessment
        await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'signals selected');

        logger.yay('Signals processing completed successfully.');

    } catch (error) {
        logger.error('An error occurred during signal processing:', error);
    };

}

module.exports = { processSignalsFromPains };