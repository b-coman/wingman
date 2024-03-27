// Filename: /src/flows/doAssessmentGeneral.js

require('dotenv').config();
const marked = require('marked');
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const companyService = require('../services/companyService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger');
const logFlowTracking = require('../services/flowTrackingService');
const { systemRules, agents, emails, htmlTemplates } = require('../../config');
const { log } = require('handlebars');
const axios = require('axios');



const flowName = 'EngagementFlow';
const doEngagementFlow = async (engagementRecordId, engagementId, engagementStatus) => {
    try {
        switch (engagementStatus) {
            case "strategic directions defined": {

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
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'identify source details', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, additionalInfo: { engagementStatus, sourceId, sourceRecord, engagementSourceDetails } });

                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 2 --> call the Marketing Agent to ask about research prompt candidates
                const crewName = "Marketing";
                const taskDescription = agents.marketingTaskDescription;
                //const taskPrompt = agents.marketingTaskPrompt.replace('$(COMPANY)', company).replace('$(DOMAIN)', domain).replace('$(SOURCE_DETAILS)', engagementSourceDetails);

                //replace placeholders in the prompt
                const taskPrompt = await replacePlaceholders.generateContent(isFilePath = false, marketingTaskPrompt, { 
                    COMPANY: companyName, 
                    DOMAIN: companyDomain, 
                    SOURCE_DETAILS: engagementSourceDetails,
                    COMPANY_CONTEXT: companyContext,
                    ENGAGEMENT_CONTEXT: engagementContext,
                    CAMPAIGN_CONTEXT: campaignContext,
                });


                // Prepare data for agent tracking
                const agentData = {
                    CompanyID: companyId,
                    CrewName: crewName,
                    TaskDescription: taskDescription,
                    TaskPrompt: taskPrompt,
                    Timestamp: new Date().toISOString()
                };

                // Start tracking the agent activity
                const runID = await airtableUtils.createAgentActivityRecord(companyId, crewName, taskDescription, taskPrompt);
                logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                // Call the agent with the prompt
                const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(crewName, taskDescription, taskPrompt, agents.marketingAgentEndpoint);
                logger.info('Agent response:', agentResponse);

                // Complete tracking the agent activity with the response
                await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                // process the agent response and update the Airtable record with the prompts received
                const prompts = JSON.parse(agentResponse.result);
                for (const prompt of prompts) {
                    await insertEngagementPrompt(engagementId, prompt.statement, prompt.description, prompt.confidenceScore);
                }

                // log status, agent response done
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'AgentResponseProcessed', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { promptsLength: prompts.length } });

                // STEP 3 --> inform the source owner about the creation of strategic directions
                // Retrieve the EngagementSourceOwnerUserId
                const engagementSourceOwnerUserId = await airtableUtils.findEngagementSourceOwnerUserId(sourceId);
                logger.info(`Engagement Source Owner User ID: ${engagementSourceOwnerUserId}`);

                // Retrieve EngagementSourceOwner details
                const sourceOwnerEmail = await airtableUtils.findUserEmailByUserId(engagementSourceOwnerUserId);
                logger.info(`Source Owner Email: ${sourceOwnerEmail}`);

                // send the email to the source owner
                await sendEmail(sourceOwnerEmail, "New Engagement Created", `Hi, a new engagement has been created with company: ${company} and contact: ${firstName} ${lastName}.`);
                logger.info(`Email sent successfully to: ${sourceOwnerEmail}`);

                // log status --> email sent
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { sourceOwnerEmail: sourceOwnerEmail } });

                // log status --> flow ends
                await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'Completed', flowStep: 'flow end', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: {} });


            }
        };

    } catch (error) {
        logger.error(`Error in engagement flow for EngagementID ${engagementId}: ${error}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'error', error.message); // Flow tracking: Error
        throw error;
    }
};

module.exports = doEngagementFlow;
