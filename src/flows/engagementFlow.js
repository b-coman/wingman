// Filename: /src/flows/doAssessmentGeneral.js

require('dotenv').config();
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const { validateJson } = require('../services/jsonValidationService');
const logger = require('../../logger');
const logFlowTracking = require('../services/flowTrackingService');
const { systemRules, agents, emails, htmlTemplates } = require('../../config');

//const companyService = require('../services/companyService');
//const marked = require('marked');
//const axios = require('axios');
//const { log } = require('handlebars');
//const { stringify } = require('ajv');


const flowName = 'EngagementFlow';
const doEngagementFlow = async (engagementRecordId, engagementId, engagementStatus) => {
    try {
        switch (engagementStatus) {
            case "created": { // this means we are ready to move to "strategic directions defined"... so let's proceed

                logger.yay(`entering the branch for a new engagement with engagementStatus = ${engagementStatus}, engagementRecordId = ${engagementRecordId}, engagementId = ${engagementId}`);
                // log status, flow started
                await logFlowTracking({ flowName: flowName, flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, additionalInfo: { engagementStatus } });


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 1 - identify source details
                var sourceId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'SourceID');
                sourceId = sourceId[0];

                // identify the decription about the article, the EngagementSourceDetails
                const engagementSourceDetails = await airtableUtils.findFieldValueByRecordId('WingmanSources', sourceId, 'EngagementSourceDetails');

                // log status, end of step
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'identify source details', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, additionalInfo: { engagementStatus, sourceId, engagementSourceDetails } });


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 2 --> call the Marketing Agent to ask about research prompt candidates
                //const crewName = "Marketing";
                //const taskDescription = agents.marketingTaskDescription;


                const engagementDetails = await airtableUtils.getFieldsForRecordById('Engagements', engagementRecordId);
                const companyRecordId = engagementDetails.CompanyID[0];
                const companyDetails = await airtableUtils.getFieldsForRecordById('Companies', companyRecordId);

                // extract the crew JSON from Airtable, table WingmanAIsquads
                const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'initial_research');
                const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
                const crewName = crewDetails.SquadName;
                const crewJson = crewDetails.SquadJSON;

                logger.info(crewJson);

                //replace placeholders in the prompt
                var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
                    COMPANY: companyDetails.CompanyName,
                    DOMAIN: companyDetails.CompanyDomain,
                    SOURCE_DETAILS: engagementSourceDetails,
                    COMPANY_CONTEXT: companyDetails.CompanyNotes,
                    ENGAGEMENT_CONTEXT: engagementDetails.EngagementSalesContext,
                    CAMPAIGN_CONTEXT: engagementDetails.EngagementInitialContext,
                    SYSTEM_RULES: systemRules.rule1
                });

                logger.info(`Agent payload: \n${crewPayload}`);
                logger.warn("Now calling agent...");


                // Start tracking the agent activity
                // const runID = await airtableUtils.createAgentActivityRecord(companyRecordId, crewName, taskDescription, taskPrompt);
                // logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                // Call the agent with the prompt
                const schemaPath = '../../schema/crewAiResponseSchema.json'; 
                const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload, schemaPath);

                // Complete tracking the agent activity with the response
                //   await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);



                // const schemaPath = '../../schema/crewAiResponseSchema.json';
                // const validationResult = await validateJson(agentResponse, schemaPath);

                // if (validationResult.valid) {
                //     logger.info('Agent response is valid.');
                //     // Process the valid response here
                // } else {
                //     logger.error(`Agent response validation failed: ${JSON.stringify(validationResult.errors)}`);
                //     // Handle the validation failure (e.g., retry, log, alert)
                // }


                // process the agent response and update the Airtable record with the prompts received
                const areas = agentResponse.result.areas;
                for (const area of areas) {
                    await airtableUtils.insertEngagementPrompt(engagementRecordId, area.statement, area.description, area.confidenceScore);
                }

                // log status, agent response done
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'AgentResponseProcessed', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId });


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                // STEP 2.5 --> Update status for engagement to "strategic directions defined"

                //WORK HERE!!

                await airtableUtils.updateRecordField('Engagements', engagementRecordId, 'EngagementStatus', 'strategic directions defined');

                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                // STEP 3 --> inform the source owner about the creation of strategic directions

                // identify the source owner
                const engagementSourceOwnerUserId = engagementDetails['EngagementSourceOwner (from SourceID)'];
                logger.info(`Engagement Source Owner User ID: ${engagementSourceOwnerUserId}`);

                // Retrieve details about EngagementSourceOwner
                const userDetails = await airtableUtils.getFieldsForRecordById('Users', engagementSourceOwnerUserId);

                // replace placeholders for subject and body
                const emailSubject = await replacePlaceholders.generateContent(isFilePath = false, emails.adminStrategicDirectionsSubject, { COMPANY_NAME: companyDetails.CompanyName });
                const emailContent = await replacePlaceholders.generateContent(isFilePath = false, emails.adminStrategicDirectionsContent, { COMPANY_NAME: companyDetails.CompanyName, ENGAGEMENT_ID: engagementId });
                const emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_admin', { USER_FIRSTNAME: userDetails.UserFirstName, MESSAGE_BODY: emailContent });

                // send the email to the source owner
                await sendEmail(userDetails.UserEmail, emailSubject, emailBody);
                logger.info(`Email sent successfully to: ${userDetails.UserEmail}`);

                // log status --> email sent
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, additionalInfo: { sourceOwnerEmail: userDetails.UserEmail } });

                // log status --> flow ends
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'Completed', flowStep: 'flow end', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, additionalInfo: {} });
            }
        };

    } catch (error) {
        logger.error(`Error in engagement flow for EngagementID ${engagementId}: ${error}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'error', error.message); // Flow tracking: Error
        throw error;
    }
};

module.exports = doEngagementFlow;
