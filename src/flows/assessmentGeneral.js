// Filename: /src/flows/doAssessmentGeneral.js

const { sendEmail } = require('../services/emailService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger'); 
const logFlowTracking = require('../services/flowTrackingService');

const flowName = 'AssessmentGeneralFlow';
const doAssessmentGeneral = async (engagementRecordId, engagementId, assessmentRecordId, assessmentId, approvedPromptId) => { 
    try {
        await logFlowTracking({flowName: flowName, flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { approvedPromptId }});

        logger.info(`Starting general assessment flow for AssessmentRecordID=${assessmentRecordId}, AssessmentID ${assessmentId}`);
        logger.info(`   EngagementRecordID: ${engagementRecordId}`);
        logger.info(`   EngagementID: ${engagementId}`);
        logger.info(`   AssessmentRecordID: ${assessmentRecordId}`);
        logger.info(`   AssessmentID: ${assessmentId}`);
        logger.info(`   ApprovedPromptID: ${approvedPromptId}`);

        //Step 1 - identify contact details
        const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
        const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
        const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');
        
        await logFlowTracking({flowName: flowName, flowStatus: 'In Progress', flowStep: 'identify contact details', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail }});

        //logger.info(`Contact details for EngagementID ${engagementId}: ${contactFirstName}, ${contactLastName}, ${contactEmail}`);

        //Step 1 - Send an onboarding email to the client
        const onboardingContent = 'Your personalized onboarding content here'; // Placeholder: Define the content or fetch it from a predefined template
        await sendEmail(contactEmail, "Subject for onboading email", `Hello, ${contactEmail}. This is your onboarding email for the EngagementID ${engagementId}. ${onboardingContent}`);
        logger.info(`Onboarding email sent to client for AssessmentID ${assessmentId}`);
        
        await logFlowTracking({flowName: flowName, flowStatus: 'In Progress', flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {contactFirstName, contactLastName, contactEmail}});

        // Step 2 - Make a call to wingman-agents app for the assessment creation
       // const assessmentReport = await wingmanAgentsService.callWingmanAgentsApp(assessmentId);
       // logger.info('Assessment report generated by Wingman-agents app');

        // Step 3 - Save assessment report to Airtable (or appropriate storage)
        // Placeholder for saving assessment report. Ensure you have a service function to update the report in Airtable
      //  await airtableService.saveAssessmentReport(assessmentId, assessmentReport);
        //logger.info(`Assessment report saved for AssessmentID ${assessmentId}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'assessmentReportSaved'); // Flow tracking: Assessment Report Saved

        // Step 4 - Notify the SourceOwner through an email that the report is ready for review
         // Retrieve the email address of the EngagementSourceOwner
        // const sourceOwnerEmail = await airtableUtils.findUserEmailByUserId(sourceOwnerId);
        // logger.info(`Source Owner Email: ${sourceOwnerEmail}`);
       // let sourceId = 'SRC-001';
         //       logger.info(`Engagement Source ID: ${sourceId}`);
                // finds the EngagementSourceOwnerUserId
          //      const sourceOwnerId = await airtableUtils.findEngagementSourceOwnerUserId(sourceId);
          //      findRecordIdByIdentifier (tableName, fieldName, identifier)
          //      logger.info(`Engagement Source Owner User ID: ${engagementSourceOwnerUserId}`);
       // const sourceOwnerEmail = 'sourceOwner@example.com'; // Placeholder: Fetch this from your database or environment
        //await sendEmailNotification(sourceOwnerEmail, "Assessment Report Ready for Review", `The assessment report for AssessmentID ${assessmentId} is ready for review.`);
        //logger.info(`Notification email sent to SourceOwner for AssessmentID ${assessmentId}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'sourceOwnerNotified'); // Flow tracking: SourceOwner Notified

        // Placeholder: Steps for review and approval by the SourceOwner are not automated and require manual intervention

        logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentRecordId}, AssessmentID=${assessmentId}`);
        await logFlowTracking({flowName: flowName, flowStatus: 'Completed', flowStep: 'closing', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {}});
    } catch (error) {
        logger.error(`Error in general assessment flow for AssessmentID ${assessmentId}: ${error}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'error', error.message); // Flow tracking: Error
        throw error;
    }
};

module.exports = doAssessmentGeneral;
