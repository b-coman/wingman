// /src/flows/newEngagementFlow.js

const {
    createCompany,
    createContact,
    createEngagement
} = require('../services/engagementActions');
const airtableUtils = require('../lib/airtableUtils');
const { sendEmail } = require('../services/emailService');
const logger = require('../../logger'); 

const Ajv = require('ajv');
const ajv = new Ajv();
const marketingAgentResponseSchema = require('../../schemas/marketingAgentResponseSchema.json');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const { insertEngagementPrompt } = require('../lib/airtableUtils');
const { agents, emails } = require('../../config');
const logFlowTracking = require('../services/flowTrackingService');
const { delay } = require('../utils/utils'); // Adjust the path as necessary



// Validate function setup
const validate = ajv.compile(marketingAgentResponseSchema);

// Orchestrates the flow to create a new engagement
exports.execute = async (formData) => {
    try {
        const timestampStart = new Date().toISOString();
        logger.info('Starting new engagement flow with formData:', formData);

        // log the flow staus
        await logFlowTracking({flowName: 'EngagementFlow', flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), additionalInfo: { formData }});

        // STEP 1 --> creating/identifying initial assets 

        // Extract and prepare data received from the form
        const { name, company, role, workEmail, sourceId } = formData;
        const domain = workEmail.substring(workEmail.lastIndexOf("@") + 1);
        const [firstName, lastName] = name.split(' ');

        // Create or find the company
        const companyId = await createCompany({ name: company, domain });

        // Create or find the contact
        const contactId = await createContact({ firstName, lastName, email: workEmail, role, companyId });

        // Create the engagement
        const engagementId = await createEngagement({ companyId, contactId, sourceId, initialContext: "{}" });
        logger.info(`Engagement record ID: ${engagementId}`);
        await delay(2000); // Wait for 1 second
        //const strEngagementId = String(engagementId);

        // log the flow status
        await logFlowTracking({flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'EngagementCreated', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { companyId, contactId }});


        // identify the sentence that describe what is inside of the article, the EngagementSourceDetails
        const sourceRecord = await airtableUtils.getAllFieldsForRecord('WingmanSources', 'SourceID', formData.sourceId);
        const engagementSourceDetails = sourceRecord.EngagementSourceDetails;

        // STEP 2 --> call the Marketing Agent to ask about research prompt candidates
        const crewName = "Marketing";
        const taskDescription = agents.marketingTaskDescription;
        const taskPrompt = agents.marketingTaskPrompt.replace('$(COMPANY)', company).replace('$(DOMAIN)', domain).replace('$(SOURCE_DETAILS)', engagementSourceDetails);

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
        
        // log the flow staus
        await logFlowTracking({flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'AgentResponseProcessed', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { promptsLength: prompts.length }});

        // STEP 3 --> inform the source owner of the new engagement
        // Retrieve the EngagementSourceOwnerUserId
        const engagementSourceOwnerUserId = await airtableUtils.findEngagementSourceOwnerUserId(sourceId);
        logger.info(`Engagement Source Owner User ID: ${engagementSourceOwnerUserId}`);

        // Retrieve the email address of the EngagementSourceOwner
        const sourceOwnerEmail = await airtableUtils.findUserEmailByUserId(engagementSourceOwnerUserId);
        logger.info(`Source Owner Email: ${sourceOwnerEmail}`);

        // send the email to the source owner
        await sendEmail(sourceOwnerEmail, "New Engagement Created", `Hi, a new engagement has been created with company: ${company} and contact: ${firstName} ${lastName}.`);
        logger.info(`Email sent successfully to: ${sourceOwnerEmail}`);

        // log the flow staus --> email sent
        await logFlowTracking({flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { sourceOwnerEmail: sourceOwnerEmail }});
        
        // log the flow staus --> flow ends
        await logFlowTracking({flowName: 'EngagementFlow', flowStatus: 'Completed', flowStep: 'flow end', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: {}});

        // Return success status and any relevant IDs or details
        return { success: true, companyId, contactId, engagementId };

        // -------------- Flow ends here --------------------

    } catch (error) {
        logger.error('Error executing new engagement flow: %o', error);
        // Rethrowing the error after logging it
        throw error;
    }
};
