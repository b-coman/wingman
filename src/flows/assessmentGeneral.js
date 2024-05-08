// Filename: /src/flows/doAssessmentGeneral.js

require('dotenv').config();
const marked = require('marked');
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const { processAgentOutput } = require('../services/pdfReportService');
const { processSignalsFromPains } = require('../services/getSignalsForGeneralAssessmentService');
const { processQuestionsFromSignals } = require('../services/getQuestionsForGeneralAssessmentService');
const { processQuestionsToSurvey } = require('../services/createSurveyAndFormService');
const updateAssessmentDetailsService = require('../services/updateAssessmentDetailsService');
const companyService = require('../services/companyService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const flowOutputsUtils = require('../lib/flowOutputsUtils');
const peopleUtils = require('../lib/peopleUtils');
const aiValidationUtils = require('../lib/aiValidationUtils');
const logger = require('../../logger');
const logFlowTracking = require('../services/flowTrackingService');
const { appConfig, agents, emails, htmlTemplates } = require('../../config');
//const { Type } = require('ajv/dist/compile/util');
//const { DataType } = require('ajv/dist/compile/validate/dataType');
//const { log } = require('handlebars');
const axios = require('axios');



const flowName = 'AssessmentGeneralFlow';
const doAssessmentGeneral = async (engagementRecordId, engagementId, assessmentRecordId, assessmentId, approvedPromptRecordId) => {
    try {
        logger.yay(`entering the flow Assessment General flow for EngagementID=${engagementId}, AssessmentID ${assessmentId}`);
        await logFlowTracking({ flowName: flowName, flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        //get the staus for the assessment and test it
        const assessmentStatus = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, 'AssessmentStatus');
        const companyDetails = await companyService.fetchCompanyDetailsFromEngagement(engagementRecordId);

        logger.info(`Starting general assessment flow for AssessmentRecordID=${assessmentRecordId}, AssessmentID ${assessmentId}`);
        logger.info(`   EngagementRecordID:     value = ${engagementRecordId}, type = ${typeof engagementRecordId}`);
        logger.info(`   EngagementID:           value = ${engagementId}, type = ${typeof engagementId}`);
        logger.info(`   AssessmentRecordID:     value = ${assessmentRecordId}, type = ${typeof assessmentRecordId}`);
        logger.info(`   AssessmentID:           value = ${assessmentId}, type = ${typeof assessmentId}`);
        logger.info(`   AssessmentStatus:       value = ${assessmentStatus}, type = ${typeof assessmentStatus}`);
        logger.info(`   ApprovedPromptID:       value = ${approvedPromptRecordId}, type = ${typeof approvedPromptRecordId}`);
        logger.info(`   CompanyDetails:         value = ${JSON.stringify(companyDetails)}, type = ${typeof companyDetails}`);

        switch (assessmentStatus) {
            case "requested": { // new assessment --> do the initial reserach, create raw report
                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { approvedPromptRecordId } });

                // update the status for the current assessment to started
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'started');


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 1 - identify contact details
                const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
                const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
                const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');

                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'identify contact details', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });
                logger.info(`Contact details for EngagementID ${engagementId}: ${contactFirstName}, ${contactLastName}, ${contactEmail}`);


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 2 - Send an onboarding email to the client
                var emailSubject = emails.welcomeEmailSubject;
                var emailContent = emails.welcomeEmailContent;

                // Generate the email body using the emailBodyMaker service
                var emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_client', { MESSAGE_BODY: emailContent, COMPANY_NAME: companyDetails.companyName, CONTACT_FIRSTNAME: contactFirstName, CONTACT_LASTNAME: contactLastName });

                // Send the email 
                await sendEmail(contactEmail, emailSubject, emailBody);

                // log the step
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 3 --> call the generalAssess agent to receive the initial report that will be sent to the client contact

                var approvedPromptDescription = await airtableUtils.findFieldValueByRecordId('EngagementPrompts', approvedPromptRecordId, 'EngagementPromptDescription');
                approvedPromptDescription = JSON.stringify(approvedPromptDescription);

                // extract the crew JSON from Airtable, table WingmanAIsquads
                // !!!--> HERE the hardcoded parameter "first_research" SHOULD BE CHANGED TO A CONFIG VARIABLE !!!!!!!!!!!!!
                const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'second_reserach');
                const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
                const crewName = crewDetails.SquadName;
                const crewJson = crewDetails.SquadJSON;

                //logger.info(crewJson);
                logger.info(`Company Name: ${companyDetails.companyName}`);

                //replace placeholders in the payload
                var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
                    COMPANY: companyDetails.companyName,
                    DOMAIN: companyDetails.companyDomain,
                    APPROVED_PROMPT: approvedPromptDescription.replace(/"/g, '\\"')
                });

                logger.info(`Agent payload: \n${crewPayload}`);
                logger.warn("Now calling agent...");

                // Start tracking the agent activity
                const runID = await airtableUtils.createAgentActivityRecord(companyDetails.companyRecordId, crewName, crewPayload);
                logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                // Call the agent army with the payload // schema path is used to validate the response
                // const schemaPath = '../../schema/crewAiResponseSchema.json'; 
                const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload);
                const agentResponseResult = agentResponse.result;
                logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

                // Complete tracking the agent activity with the response
                await airtableUtils.updateAgentActivityRecord(runID, JSON.stringify(agentResponse, null, 4));


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //-STEP 4 --> update Airtable records
                // update with the agent result in Airtable
                const assessmentDetailsStatus = appConfig.rawreportRequireApproval ? 'pending' : 'approved';   // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessRawResultId, assessmentDetailsStatus);

                // update the status for the current assessment
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'research done');


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 5 - Notify the Source Owner that the raw report is ready for review
                // Retrieve the EngagementSourceOwnerUserId
                const engagementSourceOwnerUserId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'EngagementSourceOwner (from SourceID)');

                // Retrieve the email address of the EngagementSourceOwner
                const sourceOwnerFirstName = await airtableUtils.findFieldValueByRecordId('Users', engagementSourceOwnerUserId, 'UserFirstName');
                const sourceOwnerEmail = await airtableUtils.findFieldValueByRecordId('Users', engagementSourceOwnerUserId, 'UserEmail');

                const agentResponseResultHTML = marked.parse(agentResponseResult);

                // make the replacements and creates the subject and the body for the email
                emailSubject = await replacePlaceholders.generateContent(isPath = false, emails.adminRawReportGeneratedSubject, { COMPANY_NAME: companyDetails.companyName });
                emailContent = await replacePlaceholders.generateContent(isPath = false, emails.adminRawReportGeneratedContent, { COMPANY_NAME: companyDetails.companyName, ENGAGEMENT_ID: engagementId, ASSESSMENT_ID: assessmentId });
                emailBody = await replacePlaceholders.generateContent(isPath = true, 'email_admin', { MESSAGE_BODY: emailContent, USER_FIRSTNAME: sourceOwnerFirstName, AGENT_RESPONSE: agentResponseResultHTML });

                // Send the email 
                await sendEmail(sourceOwnerEmail, emailSubject, emailBody);
                logger.info(`Email sent successfully to: ${sourceOwnerEmail}`);

                // log the flow status --> email sent
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { sourceOwnerEmail: sourceOwnerEmail } });

                // log the flow status --> end of branch
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'end of branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                logger.yay(`The first major branch in the general assessment is DONE --> AssessmentID=${assessmentId}`);
                break;

                // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

            }

            case "research done": { // research done --> proceed with pain identification

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = potential pains', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // find the ID of the record in AssessmentDetails table where to place the record for pains identified by the agent
                var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
                assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id

                // find the ID of the record in AssessmentDetails table from where to extract the raw report
                var assessmentDetailsForRawReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
                assessmentDetailsForRawReportId = assessmentDetailsForRawReportId[0].id

                // extract the values for the raw report
                const rawReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForRawReportId, 'Value');
                const rawReportStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForRawReportId, 'Status');
                // seriailze raw report
                const jsonRawReport = JSON.stringify(rawReport);

                if (rawReportStatus == 'approved') { // --> this means we can proceed with identifying the pains

                    // create the list with all pains (will be passed to the agent inside of the prompt as JSON)
                    var painData = await airtableUtils.fetchPainsData();
                    // serialiize signals data
                    var jsonPainsData = JSON.stringify(painData);

                    // extract the crew JSON from Airtable, table WingmanAIsquads
                    // !!!--> HERE the hardcoded parameter "identify_pains" SHOULD BE CHANGED TO A CONFIG VARIABLE !!!!!!!!!!!!!
                    const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'identify_pains');
                    const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
                    const crewName = crewDetails.SquadName;
                    const crewJson = crewDetails.SquadJSON;

                    //replace placeholders in the payload
                    var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
                        COMPANY: companyDetails.CompanyName,
                        INITIAL_RESEARCH: jsonRawReport.replace(/"/g, '\\"'),
                        PAINS_LIST: jsonPainsData.replace(/"/g, '\\"')
                    });

                    logger.info(`Agent payload: \n${crewPayload}`);
                    logger.warn("Now calling agent...");

                    // Start tracking the agent activity
                    const runID = await airtableUtils.createAgentActivityRecord(companyDetails.companyRecordId, crewName, crewPayload);
                    logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                    // Call the agent army with the payload // schema path is used to validate the response
                    const schemaPath = '../../schema/crewAiResponseSchema_pains.json';
                    const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload, schemaPath);
                    var agentResponseResult = agentResponse.result;
                    logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

                    // Complete tracking the agent activity with the response
                    await airtableUtils.updateAgentActivityRecord(runID, JSON.stringify(agentResponse, null, 4));

                    // insert the pains identified by the agent into the AssessmentDetails:Pains table
                    await airtableUtils.createPainAssessmentDetails(agentResponseResult, assessmentDetailsForPainsId, runID);

                    // Complete tracking the agent activity with the response
                    await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                    // update with the agent result in Airtable
                    agentResponseResult = JSON.stringify(agentResponseResult)
                    const assessmentDetailsStatus = appConfig.painRequireApproval ? 'pending' : 'approved';  // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                    await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessPainPointsId, assessmentDetailsStatus);

                    // update the status for the current assessment
                    await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'pains identified');

                    //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                    //INFORM SOURCE OWNER!!

                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'identify potential pains', stepStatus: 'done', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentId}`);

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The raw research was not approved, so we need to ask the source owner to approve the raw research before we can continue with the general assessment`);
                }
                break
            }

            case "pains identified": { // pains identified --> proceed to signal identification

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                logger.info(`Proceeding to signal identification....`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = web reserach', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // find the ID of the record in AssessmentDetails where the record for potential pains is located
                var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
                assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id

                const potentialPainsStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'Status');
                logger.info(`potential pains status = ${potentialPainsStatus}`);

                if (potentialPainsStatus == 'approved') { // --> this means we can proceed signal identification

                    // call the service to process signals from pains
                    await processSignalsFromPains(engagementRecordId, assessmentRecordId, assessmentId, flowName, assessmentStatus);

                    logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'closing the branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The pains were not approved, so we need to ask the source owner to approve the pains before we can continue with the general assessment`);
                }
                break;
            }

            case "signals selected": { // signals done --> proceed with questions selections, question reformulation !!! NOT FINISHED YET

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'initiatilization', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // find the ID of the record in AssessmentDetails where the record for signals is located
                var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
                assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id

                const signalsStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForSignalsId, 'Status');
                logger.info(`Signals status = ${signalsStatus}`);

                if (signalsStatus == 'approved') { // --> this means we can proceed with the next step, the questions

                    // call the service to process questions from signals
                    await processQuestionsFromSignals(engagementRecordId, assessmentRecordId, assessmentId, flowName, assessmentStatus);

                    logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'closing the branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                }
                else {
                    //something went wrong with the signals, so we need to ask the user to provide more information
                    logger.warn(`The signals were not approved, so we need to ask the source owner to approve the signals before we can continue with the general assessment`);
                }
                break;
            }

            case "questions selected": {   // questions selected --> create the survey, create form in Typeform

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'initiatilization', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // find the ID of the record in AssessmentDetails where the record for questions is located
                var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
                assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id

                const questionsStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForQuestionsId, 'Status');
                logger.info(`Questions status = ${questionsStatus}`);

                if (questionsStatus == 'approved') { // --> this means we can proceed with the next step, the survey and the typeform

                    // call the service to create the survey and the typeform from questions
                    const processQuestionsResult = await processQuestionsToSurvey(engagementRecordId, assessmentRecordId, assessmentId, flowName, assessmentStatus);
                    const surveyRecordId = processQuestionsResult.surveyRecordId;
                    const typeformId = processQuestionsResult.typeformId;
                    var typerformUrl = processQuestionsResult.typeformUrl;


                    // inform the contact on client side that survey is ready

                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'send the survey', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    const companyName = companyDetails.companyName;
                    const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
                    const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
                    const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');

                    // put first name and company name in typeform url
                    typerformUrl = typerformUrl + `?fname=${contactFirstName}`;

                    // Generate the email body using the emailBodyMaker service
                    const emailSubject = await replacePlaceholders.generateContent(isFilePath = false, emails.surveyEmailSubject, { COMPANY_NAME: companyName });
                    const emailContent = await replacePlaceholders.generateContent(isFilePath = false, emails.surveyEmailContent, { COMPANY_NAME: companyDetails.companyName, TYPEFORM_URL: typerformUrl });
                    const emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_client', { CONTACT_FIRSTNAME: contactFirstName, MESSAGE_BODY: emailContent });

                    //logger.info(`emailBody = ${emailBody}`);

                    // Send the email 
                    await sendEmail(contactEmail, emailSubject, emailBody);

                    // log the step
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });



                    logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'closing the branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                }
                else {
                    //something went wrong with the questions, so we need to ask the user to provide more information
                    logger.warn(`The questions were not approved, so we need to ask the source owner to approve the questions before we can continue with the general assessment`);
                }
                break;
            }

            case "survey responded": {   // survey submitted --> process the responses and generate the final report

                // aici ar trebui un test sa vedem daca survey-ul a fost completat sau nu, si daca da atunci:

                logger.yay("Survey completed! Let's process responses and generate the final report.");

                // find the ID of the record in AssessmentDetails where the record for potential pains is located
                var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
                assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id

                // find the record ID in table AssessmentDetails where initial research is stored
                var assessmentDetailsForReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
                assessmentDetailsForReportId = assessmentDetailsForReportId[0].id

                // get the refference to pains from AssessmentDetails
                const referenceToPainsRecordIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'AssessmentDetails:Pains');
                //logger.info(`painRecordIDs = ${referenceToPainsRecordIDs}`);

                //construct the object that store details about pains
                var painsDescription = ""; var counter = 1;
                for (const referenceToPainsRecordId of referenceToPainsRecordIDs) {
                    try {

                        const painData = await airtableUtils.getFieldsForRecordById('Pains', referenceToPainsRecordId);
                        const painRecordId = painData['PainID'];
                        logger.info(`painRecordId = ${painRecordId}`);
                        const painStatement = painData['PainStatement (from PainID)'];
                        const painImpact = painData['Business impact (from PainID)']
                        const painWhatWeFeel = painData['What we feel (from PainID)']
                        const painReason = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Pains', referenceToPainsRecordId, 'Reason');
                        painsDescription += `${counter}. ${painStatement};\n`
                            + `What happens when is pain is present: ${painImpact};\n`
                            + `What we feel when is pain is present: ${painWhatWeFeel};\n`
                            + `Why this pain was identified for this company: ${painReason}.\n`

                        counter++;
                    } catch (error) {
                        logger.error(`Error fetching data for pain record ID ${error}`);
                    }
                }
                // seriailze pains data
                var jsonPainDescription = JSON.stringify(painsDescription);

                var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
                assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id


                // fetch the questions and the answrs from the survey submisions
                const surveyData = await flowOutputsUtils.fetchSurveyDataByAssessmentID(assessmentRecordId);
                let reportQuestionsAnswers = [];  // Array to hold all the formatted strings

                // Iterate through each survey, construct the string that it will be used to populate the report
                surveyData.forEach(survey => {
                    // Iterate through each submission in the survey
                    survey.submissions.forEach(submission => {
                        // Format the submission date to show only the date part
                        const date = new Date(submission.SubmissionDate);
                        const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

                        // Start a new section for each submission with the formatted submission date
                        let submissionDetails = `Submission Date: ${formattedDate}\n`;

                        // Counter for questions/answers
                        let counter = 1;

                        // Gather all questions and answers for this submission
                        submission.responses.forEach(response => {
                            submissionDetails += `  Question #${counter}: ${response.questionStatement}\n`;
                            if (response.questionType === 'rating') {
                                submissionDetails += `  Rating scale: ${response.questionDescription}\n`;
                            }
                            submissionDetails += `  Answer: ${response.responseValue}\n`;
                            counter++; // Increment the counter for the next question/answer
                        });

                        // Add the complete details of one submission to the report strings array
                        reportQuestionsAnswers.push(submissionDetails);
                    });
                });

                reportQuestionsAnswers = reportQuestionsAnswers.join('\n');  // Join all strings with a newline character for readability
                logger.info(reportQuestionsAnswers);
                //seriailze questions and answers data
                reportQuestionsAnswers = JSON.stringify(reportQuestionsAnswers);


                //construct the Modus offering list
                const offeringData = await airtableUtils.fetchAllRecordsFromTable('ModusPracticesOfferings');
                var modusOfferingList = '';
                offeringData.forEach(offering => {
                    modusOfferingList += `Practice name: ${offering.Practice} (lead by ${offering.AssignedTo})\n`;
                    modusOfferingList += `Offering: ${offering.OfferingName}\n`;
                    modusOfferingList += `Offering description: ${offering.OfferingDescription}\n\n`;
                });
                //seriailze offering data
                modusOfferingList = JSON.stringify(modusOfferingList);
                //logger.info(modusOfferingList);


                //prepare the agent call, the additional details needed
                const companyName = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyName (from CompanyID) (from assignedToEngagement)');
                var companyRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyID (from assignedToEngagement)');
                companyRecordId = companyRecordId[0];
                const rawReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForReportId, 'Value');
                // seriailze raw report
                const jsonRawReport = JSON.stringify(rawReport);

                const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'final_report');
                const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
                const crewName = crewDetails.SquadName;
                const crewJson = crewDetails.SquadJSON;

                //replace placeholders in the payload
                var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
                    COMPANY: companyName,
                    INITIAL_RESEARCH: jsonRawReport.replace(/"/g, '\\"'),
                    PAINS_LIST: jsonPainDescription.replace(/"/g, '\\"'),
                    QUESTIONS_LIST: reportQuestionsAnswers.replace(/"/g, '\\"'),
                    MODUS_OFFERINGS: modusOfferingList.replace(/"/g, '\\"')
                });

                logger.info(`Agent payload: \n${crewPayload}`);
                logger.warn("Now calling agent...");

                // Start tracking the agent activity
                const runID = await airtableUtils.createAgentActivityRecord(companyRecordId, crewName, crewPayload);
                logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                // Call the agent army with the payload // schema path is used to validate the response
                const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload); // no validation schema for the response

                // Complete tracking the agent activity with the response
                await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                // extract the questions from the response
                var agentResponseResult = agentResponse.result;
                logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

                // update with the agent result in Airtable
                const assessmentDetailsStatus = appConfig.generalreportRequireApproval ? 'pending' : 'approved';  // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessFinalResultId, assessmentDetailsStatus);

                // update the status for the current assessment
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'general report done');

                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = web research', stepStatus: 'done', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentId}`);


                break;

            }

            case "general report done": {   // ????

            }

            case "flow concluded": {   // this means we can send the report

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = general report', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                var assessmentDetailsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessFinalResultId);
                assessmentDetailsId = assessmentDetailsId[0].id
                //logger.info(`assessmentDetailsId = ${assessmentDetailsId}`);

                const genReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsId, 'Value');
                const genReportStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsId, 'Status');
                //    logger.info(`genReport = ${genReport}`);
                //  logger.info(`genReportStatus = ${genReportStatus}`);

                if (genReportStatus == 'approved') { // --> this means we can proceed generating and sending the final report

                    // PDF FILE STEP
                    const companyName = companyDetails.companyName;
                    const companyNameFile = companyName.replace(/\s/g, "-").replace(/[\\/:*?"<>|&]/g, '');

                    // replace placeholders and convert to html
                    const genReportHTML = await replacePlaceholders.generateContent(isPath = false, htmlTemplates.pdfReport, { REPORT: marked.parse(genReport) });

                    // generate PDF and return its url
                    const pdfReturn = await processAgentOutput(genReportHTML, assessmentDetailsId, companyNameFile, assessmentId);
                    const pdfFileURL = pdfReturn[1];
                    const pdfFileName = pdfReturn[0];

                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'create PDF report', stepStatus: 'completed', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });


                    //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                    //- STEP 6 --> send email to the client contact with the report as attachement

                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'send final report', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });


                    // Download PDF from PDFShift storage as a buffer
                    const response = await axios.get(pdfFileURL, { responseType: 'arraybuffer' });
                    const pdfBuffer = response.data;

                    // Send email with PDF attachment using the buffer
                    const emailAttachement = [{
                        filename: pdfFileName, // The filename to appear in the email
                        content: pdfBuffer, // Use the buffer directly as the content of the attachment
                        contentType: 'application/pdf',
                    }];

                    // logger.info(`companyName = ${companyDetails.companyName}`);

                    const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
                    const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
                    const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');

                    //const emailSubject = emails.genReportEmailSubject;
                    // const emailContent = emails.genReportEmailContent;

                    // Generate the email body using the emailBodyMaker service
                    const emailSubject = await replacePlaceholders.generateContent(isFilePath = false, emails.genReportEmailSubject, { COMPANY_NAME: companyName });
                    const emailContent = await replacePlaceholders.generateContent(isFilePath = false, emails.genReportEmailContent, { COMPANY_NAME: companyDetails.companyName, REPORT_FILENAME: pdfFileName, REPORT_URL: pdfFileURL });
                    const emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_client', { CONTACT_FIRSTNAME: contactFirstName, MESSAGE_BODY: emailContent });

                    //logger.info(`emailBody = ${emailBody}`);

                    // Send the email 
                    await sendEmail(contactEmail, emailSubject, emailBody, emailAttachement);

                    // log the step
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });


                    logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: '3rd branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    break;

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The raw research was not approved, so we need to ask the source owner to approve the raw research before we can continue with the general assessment`);
                }
            }

            default: {
                logger.error(`The assessmentStatus is not valid: ${assessmentStatus}`);
                //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'error', `The assessmentStatus is not valid: ${assessmentStatus}`); // Flow tracking: Error
                throw new Error(`The assessmentStatus is not valid: ${assessmentStatus}`);
            }


        };

    } catch (error) {
        logger.error(`Error in general assessment flow for AssessmentID ${assessmentId}: ${error}`);
        //logFlowEvent(assessmentId, 'doAssessmentGeneral', 'error', error.message); // Flow tracking: Error
        throw error;
    }
};

module.exports = doAssessmentGeneral;
