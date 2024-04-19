// Filename: /src/flows/doAssessmentGeneral.js

require('dotenv').config();
const marked = require('marked');
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const { processAgentOutput } = require('../services/pdfReportService');
const { processSignalsFromPains } = require('../services/getSignalsForGeneralAssessmentService');
const { processQuestionsFromSignals } = require('../services/getQuestionsForGeneralAssessmentService');
const updateAssessmentDetailsService = require('../services/updateAssessmentDetailsService');
const companyService = require('../services/companyService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
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

        switch (assessmentStatus) {
            case "requested": { // this is a new assessment, proceed with raw report
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

                const approvedPromptDescription = await airtableUtils.findFieldValueByRecordId('EngagementPrompts', approvedPromptRecordId, 'EngagementPromptDescription');


                // extract the crew JSON from Airtable, table WingmanAIsquads
                // !!!--> HERE the hardcoded parameter "first_research" SHOULD BE CHANGED TO A CONFIG VARIABLE !!!!!!!!!!!!!
                const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'second_reserach');
                const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
                const crewName = crewDetails.SquadName;
                const crewJson = crewDetails.SquadJSON;

                logger.info(crewJson);

                //replace placeholders in the payload
                var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
                    COMPANY: companyDetails.CompanyName,
                    DOMAIN: companyDetails.CompanyDomain,
                    APPROVED_PROMPT: approvedPromptDescription
                });


                logger.info(`Agent payload: \n${crewPayload}`);
                logger.warn("Now calling agent...");

                // Start tracking the agent activity
                //const runID = await airtableUtils.createAgentActivityRecord(companyRecordId, crewName, crewPayload);
                //logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

                // Call the agent army with the payload // schema path is used to validate the response
               // const schemaPath = '../../schema/crewAiResponseSchema.json'; 
                const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload);
                logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

                // Complete tracking the agent activity with the response
               // await airtableUtils.updateAgentActivityRecord(runID, JSON.stringify(agentResponse, null, 4));



                // const crewName = "generalAssess";
                // const taskDescription = agents.generalAssessDescription;
                // const taskPrompt = agents.generalAssessTaskPrompt.replace('$(COMPANY)', companyDetails.companyName).replace('$(DOMAIN)', companyDetails.companyDomain).replace('$(APPROVED_PROMPT)', approvedPromptDescription);
                // logger.info(`TaskPrompt: ${taskPrompt}`);

                // // Prepare data for agent tracking
                // const agentData = {
                //     CompanyID: companyDetails.companyRecordId,
                //     CrewName: crewName,
                //     TaskDescription: taskDescription,
                //     TaskPrompt: taskPrompt,
                //     Timestamp: new Date().toISOString()
                // };

                // // Start tracking the agent activity
                // const runID = await airtableUtils.createAgentActivityRecord(agentData.CompanyID, agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt);

                // // Call the agent with the prompt
                // const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt, agents.generalAssessAgentEndpoint);
                 const agentResponseResult = agentResponse.result;
                // logger.info(agentResponseResult);

                // // Complete tracking the agent activity with the response
                // await airtableUtils.updateAgentActivityRecord(runID, agentResponse);


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //-STEP 4 --> update Airtable records
                // update with the agent result in Airtable
                const assessmentDetailsStatus = appConfig.rawreportRequireApproval ? 'pending' : 'approved';   // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessRawResultId, assessmentDetailsStatus);

                // update the status for the current assessment
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'web research done');


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
                await sendEmail(contactEmail, emailSubject, emailBody);

                logger.info(`Email sent successfully to: ${sourceOwnerEmail}`);

                // log the flow status --> email sent
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { sourceOwnerEmail: sourceOwnerEmail } });

                // log the flow status --> end of branch
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'end of branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                logger.yay(`The first major branch in the general assessment is DONE --> AssessmentID=${assessmentId}`);
                break;

                // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

            }

            case "web research done": { //this means we can move on the pain identification step

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

                if (rawReportStatus == 'approved') { // --> this means we can proceed with identifying the pains

                    // create the list with all pains (will be passed to the agent inside of the prompt as JSON)
                    const allPains = await airtableUtils.fetchPainsData();

                    // create the task prompt
                    var taskPrompt = await replacePlaceholders.generateContent(isFilePath = false, agents.generalPainsIdentifierTaskPrompt, { INITIAL_RESEARCH: rawReport, PAINS_LIST: JSON.stringify(allPains) });

                    // Prepare agent
                    const agentData = {
                        CompanyID: companyDetails.companyRecordId,
                        CrewName: "dataAnalytics",
                        TaskDescription: agents.generalPainsIdentifierDescription,
                        TaskPrompt: taskPrompt,
                        Timestamp: new Date().toISOString()
                    };

                    // Start tracking the agent activity
                    const runID = await airtableUtils.createAgentActivityRecord(agentData.CompanyID, agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt);

                    // Call the agent with the prompt
                    const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt, agents.generalPainsIdentifierEndpoint);
                    var agentResponseResult = agentResponse.result;
                    agentResponseResult = JSON.parse(agentResponseResult);

                    // insert the pains identified by the agent into the AssessmentDetails:Pains table
                    await airtableUtils.createPainAssessmentDetails(agentResponseResult, assessmentDetailsForPainsId, runID);

                    // Complete tracking the agent activity with the response
                    await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                    // update with the agent result in Airtable
                    agentResponseResult = JSON.stringify(agentResponseResult)
                    const assessmentDetailsStatus = appConfig.painRequireApproval ? 'pending' : 'approved';  // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                    await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessPainPointsId, assessmentDetailsStatus);

                    // update the status for the current assessment
                    await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'potential pains done');

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

            case "potential pains done": {  // this means we can proceed with creating the final report

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = web reserach', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // find the ID of the record in AssessmentDetails where the record for potential pains is located
                var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
                assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id

                const potentialPainsStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'Status');
                logger.info(`potential pains status = ${potentialPainsStatus}`);

                if (potentialPainsStatus == 'approved') { // --> this means we can proceed with the final report

                    const IDinAssessmentDetailsForPainsList = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'AssessmentDetails:Pains');
                    logger.info(`IDinAssessmentDetailsForPainsList = ${IDinAssessmentDetailsForPainsList}`);

                    var painDetailsList = [];
                    const seenPainSKUs = new Set(); // Set to track seen painSKUs

                    for (const id of IDinAssessmentDetailsForPainsList) {
                        console.log(id); // Log the current ID

                        try {
                            const painID = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Pains', id, 'PainID');
                            const painSKU = await airtableUtils.findFieldValueByRecordId('Pains', painID, 'PainSKU');
                            // Skip this iteration if we've already seen this painSKU
                            if (seenPainSKUs.has(painSKU)) continue;
                            // Since this painSKU is new, add it to the set
                            seenPainSKUs.add(painSKU);
                            const painStatement = await airtableUtils.findFieldValueByRecordId('Pains', painID, 'PainStatement');
                            const painDescription = await airtableUtils.findFieldValueByRecordId('Pains', painID, 'What we feel');
                            const painImpact = await airtableUtils.findFieldValueByRecordId('Pains', painID, 'Business impact');

                            // Construct the object and push it to the list
                            painDetailsList.push({
                                painSKU: painSKU,
                                painStatement: painStatement,
                                painDescription: painDescription,
                                painImpact: painImpact
                            });

                        } catch (error) {
                            console.error(`Error processing ID ${id}:`, error);
                        }
                    }

                    // Convert the array to JSON
                    const painDetailsJson = JSON.stringify(painDetailsList);
                    console.log(painDetailsJson);
                    // Now you have your JSON ready to be sent to an agent


                    //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                    //- STEP 6 --> create the final report

                    // find the ID of the record in AssessmentDetails where the record for raw report is located
                    var assessmentDetailsForRawReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
                    assessmentDetailsForRawReportId = assessmentDetailsForRawReportId[0].id

                    const rawReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForRawReportId, 'Value');
                    //const rawReportStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForRawReportId, 'Status');

                    //extract company details, and put them in an object
                    const companyDetails = await companyService.fetchCompanyDetailsFromEngagement(engagementRecordId);

                    // replace placeholders, create task prompt
                    var taskPrompt = await replacePlaceholders.generateContent(isFilePath = false, agents.generalReportTaskPrompt, { INITIAL_RESEARCH: rawReport, PAINS: painDetailsJson, COMPANY: companyDetails.companyName, DOMAIN: companyDetails.companyDomain });
                    logger.info(`taskPrompt = ${taskPrompt}`);

                    // create the agent data object --> this is the data that will be sent to the agent army
                    const agentData = {
                        CompanyID: companyDetails.companyRecordId,
                        CrewName: 'copywriting',
                        TaskDescription: agents.generalReportDescription,
                        TaskPrompt: taskPrompt,
                        Timestamp: new Date().toISOString()
                    };

                    // agent activity tracking - start
                    const runID = await airtableUtils.createAgentActivityRecord(agentData.CompanyID, agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt);

                    // call the agent army :)
                    const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt, agents.generalReportAgentEndpoint);

                    const agentResponseResult = agentResponse.result;
                    //const agentResponseStatus = agentResponse.status;
                    logger.info(`Agent result: ${agentResponseResult}`);

                    // Complete tracking the agent activity with the response
                    await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

                    // update with the agent result in Airtable
                    const assessmentDetailsStatus = appConfig.generalreportRequireApproval ? 'pending' : 'approved';  // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approaval
                    await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessFinalResultId, assessmentDetailsStatus);

                    // update the status for the current assessment
                    await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'general report done');

                    await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = web research', stepStatus: 'done', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentId}`);

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The raw research was not approved, so we need to ask the source owner to approve the raw research before we can continue with the general assessment`);
                }
                break;


            }

            case "general report done": {   // this means the we can indentify and validate the signals (based on the report content and the pains)

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'case = general report', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                // call the service to process signals from pains
                await processSignalsFromPains(engagementRecordId, assessmentRecordId, assessmentId, flowName, assessmentStatus);

                logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'closing the branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                break;

            }

            case "signals done": {   // this means the we can indentify the questions and create the typeform

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'initiatilization', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
               
                // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                // prepare the context data for the AI validation
                
                // get the report
                var assessmentDetailsForReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
                assessmentDetailsForReportId = assessmentDetailsForReportId[0].id;
                var reportContent = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForReportId, 'Value');
                logger.debug(`Report content: ${reportContent}`);

                // get the strategic directions --> oare chair am nevoie??


                // get the internal notes


                // get role details for this contact
                const contactRecordId = await peopleUtils.findPrimaryContactID(engagementRecordId);
                const contactDetails = await peopleUtils.fetchPeopleDetails(contactRecordId, 'contact');
                const roleName = contactDetails.RoleName;
                const roleDescription = contactDetails.RoleDescription;
                logger.debug(`Role name: ${roleName}`);
                logger.debug(`Role description: ${roleDescription}`);

                // get all questions that fit with the signals for this assessment and put in a JSON string
                const questionsJson = await processQuestionsFromSignals(engagementRecordId, assessmentRecordId, assessmentId, flowName, assessmentStatus);
                logger.debug(`questionsJson = \n${questionsJson}`);

                // ask agents to select the questions that fits with the whole context (assessment and role)
                const validatedQuestions = await aiValidationUtils.analyzeQuestionsWithContext(questionsJson, context);


break;

                logger.yay(`case for assessmentStatus = ${assessmentStatus} is completed`);
                await logFlowTracking({ flowName: flowName, flowStatus: assessmentStatus, flowStep: 'close the branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                break;

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
                    const companyNameFile = companyName.replace(/\s/g, "-");

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
