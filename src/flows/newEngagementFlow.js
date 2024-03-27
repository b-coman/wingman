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
const replacePlaceholders = require('../services/replacePlaceholders');
const companyService = require('../services/companyService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const { insertEngagementPrompt } = require('../lib/airtableUtils');
const { agents, emails } = require('../../config');
const logFlowTracking = require('../services/flowTrackingService');
const { delay } = require('../utils/utils'); // Adjust the path as necessary


// Orchestrates the flow to create a new engagement
exports.execute = async (formData) => {
    try {
        logger.yay('Starting new engagement flow with formData:', formData);

        // log the flow staus
        await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), additionalInfo: { formData } });

        // STEP 1 --> creating/identifying initial assets 
        // Extract and prepare data received from the form
        const { name, company, role, workEmail, sourceId, engagementInitialContext } = formData;
        const domain = workEmail.substring(workEmail.lastIndexOf("@") + 1);
        const [firstName, lastName] = name.split(' ');

        // Create or find the company
        const companyId = await createCompany({ name: company, domain });

        // Create or find the contact
        const contactId = await createContact({ firstName, lastName, email: workEmail, role, companyId });

        // Create the engagement
        const engagementId = await createEngagement({ companyId, contactId, sourceId, initialContext: engagementInitialContext });
        logger.info(`Engagement record ID: ${engagementId}`);
        await delay(2000); // Wait for 1 second
        //const strEngagementId = String(engagementId);

        // log the flow status
        await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'EngagementCreated', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { companyId, contactId } });

        //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        // STEP 3 --> inform the source owner of the new engagement
        // Retrieve the source details
        const engagementSourceOwnerUserId = await airtableUtils.findEngagementSourceOwnerUserId(sourceId);
        const sourceRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanSources', 'SourceID', sourceId);
        const sourceName = await airtableUtils.findFieldValueByRecordId('WingmanSources', sourceRecordId, 'EngagementSourceName');
        logger.info(`Engagement Source Owner User ID: ${engagementSourceOwnerUserId}`);

        // Retrieve the email address of the EngagementSourceOwner
        const userDetails = await airtableUtils.getFieldsForRecordById('Users', engagementSourceOwnerUserId);
        logger.info(`Source Owner Email: ${userDetails.UserEmail}`);

        // Retrieve the company details
        const companyDetails = await companyService.fetchCompanyDetailsFromEngagement(engagementId);

        // send the email to the source owner
        const emailSubject = emails.adminNewEngagementSubject;
        const emailContent = await replacePlaceholders.generateContent(isFilePath = false, emails.adminNewEngagementContent, { COMPANY_NAME: companyDetails.companyName, CONTACT_NAME: companyDetails.contactFullName, SOURCE_NAME: sourceName });
        const emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_admin', { USER_FIRSTNAME: userDetails.UserFirstName, MESSAGE_BODY: emailContent });

        await sendEmail(userDetails.UserEmail, emailSubject, emailBody);
        logger.info(`Email sent successfully to: ${userDetails.UserEmail}`);

        // log the flow staus --> email sent
        await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'In Progress', flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: { sourceOwnerEmail: userDetails.UserEmail } });

        // log the flow staus --> flow ends
        await logFlowTracking({ flowName: 'EngagementFlow', flowStatus: 'Completed', flowStep: 'flow end', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementId, additionalInfo: {} });

        // Return success status and any relevant IDs or details
        return { success: true, companyId, contactId, engagementId };

    } catch (error) {
        logger.error('Error executing new engagement flow: %o', error);
        // Rethrowing the error after logging it
        throw error;
    }
};
