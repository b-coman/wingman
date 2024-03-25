// Filename: /src/flows/doAssessmentGeneral.js

require('dotenv').config();
const marked = require('marked');
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const { processAgentOutput } = require('../services/pdfReportService');
const updateAssessmentDetailsService = require('../services/updateAssessmentDetailsService');
const companyService = require('../services/companyService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger');
const logFlowTracking = require('../services/flowTrackingService');
const { agents, emails } = require('../../config');
const { Type } = require('ajv/dist/compile/util');
const { DataType } = require('ajv/dist/compile/validate/dataType');
const { log } = require('handlebars');


const flowName = 'AssessmentGeneralFlow';
const doAssessmentGeneral = async (engagementRecordId, engagementId, assessmentRecordId, assessmentId, approvedPromptRecordId) => {
    try {
        //get the staus for the assessment and test it
        const assessmentStatus = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, 'AssessmentStatus');
        const companyDetails = await companyService.fetchCompanyDetailsFromEngagement(engagementRecordId);

        switch (assessmentStatus) {
            case "requested": {
                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: 'Started', flowStep: 'initialization', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { approvedPromptRecordId } });

                // update the status for the current assessment to started
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'started');

                logger.info(`Starting general assessment flow for AssessmentRecordID=${assessmentRecordId}, AssessmentID ${assessmentId}`);
                logger.info(`   EngagementRecordID: value = ${engagementRecordId}, type = ${typeof engagementRecordId}`);
                logger.info(`   EngagementID: value = ${engagementId}, type = ${typeof engagementId}`);
                logger.info(`   AssessmentRecordID: value = ${assessmentRecordId}, type = ${typeof assessmentRecordId}`);
                logger.info(`   AssessmentID: value = ${assessmentId}, type = ${typeof assessmentId}`);
                logger.info(`   ApprovedPromptID: value = ${approvedPromptRecordId}, type = ${typeof approvedPromptRecordId}`);


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 1 - identify contact details
                const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
                const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
                const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');

                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'identify contact details', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });
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
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 3 --> call the generalAssess agent to receive the initial report that will be sent to the client contact

                const approvedPromptDescription = await airtableUtils.findFieldValueByRecordId('EngagementPrompts', approvedPromptRecordId, 'EngagementPromptDescription');

                const crewName = "generalAssess";
                const taskDescription = agents.generalAssessDescription;
                const taskPrompt = agents.generalAssessTaskPrompt.replace('$(COMPANY)', companyDetails.companyName).replace('$(DOMAIN)', companyDetails.companyDomain).replace('$(APPROVED_PROMPT)', approvedPromptDescription);
                logger.info(`TaskPrompt: ${taskPrompt}`);

                // Prepare data for agent tracking
                const agentData = {
                    CompanyID: companyDetails.companyRecordId,
                    CrewName: crewName,
                    TaskDescription: taskDescription,
                    TaskPrompt: taskPrompt,
                    Timestamp: new Date().toISOString()
                };

                // Start tracking the agent activity
                const runID = await airtableUtils.createAgentActivityRecord(agentData.CompanyID, agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt);

                // Call the agent with the prompt
                const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt, agents.generalAssessAgentEndpoint);
                const agentResponseResult = agentResponse.result;
                logger.info(agentResponseResult);

                // Complete tracking the agent activity with the response
                await airtableUtils.updateAgentActivityRecord(runID, agentResponse);


                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //-STEP 4 --> update Airtable records
                // update with the agent result in Airtable
                await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessRawResultId);

                // update the status for the current assessment
                await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'web research');


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

                // log the flow staus --> email sent
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'email sent to source owner', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { sourceOwnerEmail: sourceOwnerEmail } });

                // log the flow status --> end of branch
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'end of branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                logger.yay(`The first major branch in the general assessment is DONE --> AssessmentID=${assessmentId}`);
                break;

                // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

            } case "web research done": {
                //this means we can move on the pain identification step

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'case = potential pains', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

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
                    await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessPainPointsId);

                    // update the status for the current assessment
                    await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'potential pains done');

                    //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                    //INFORM SOURCE OWNER!!

                    await logFlowTracking({ flowName: flowName, flowStatus: 'in progress', flowStep: 'identify potential pains', stepStatus: 'done', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentId}`);

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The raw research was not approved, so we need to ask the source owner to approve the raw research before we can continue with the general assessment`);
                }
                break
            }

            case "potential pains done": {
                // this means we can proceed with creating the final report

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'case = web reserach', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

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

                    // // replaces the placeholders in the prompt
                    // const taskPrompt = agents.generalReportTaskPrompt
                    //     .replace(/\$\(COMPANY\)/g, companyDetails.companyName)
                    //     .replace(/\$\(DOMAIN\)/g, companyDetails.companyDomain)
                    //     .replace(/\$\(INITIAL_RESEARCH\)/g, rawReport);

                    // create the agent data object --> this is the data that will be sent to the agent army
                    const agentData = {
                        CompanyID: companyDetails.companyRecordId,
                        CrewName: 'copywriting',
                        TaskDescription: 'Create a comprehensive report based on data provided',
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
                    await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessFinalResultId);

                    // update the status for the current assessment
                    await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'general report done');

                    await logFlowTracking({ flowName: flowName, flowStatus: 'in progress', flowStep: 'case = web research', stepStatus: 'done', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    logger.yay(`General assessment flow completed successfully for AssessmentID=${assessmentId}`);

                }
                else {
                    //something went wrong with the raw report, so we need to ask the user to provide more information
                    logger.warn(`The raw research was not approved, so we need to ask the source owner to approve the raw research before we can continue with the general assessment`);
                }
                break;


            }
            case "general report done": {

                logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'case = general report', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //TO BE DONE: test if the final report is approved

                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                
                
                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                // WORKING HERE

                // Call processAgentOutput with necessary parameters
                await processAgentOutput(markdownContent, assessmentDetailId, companyShortName, assessmentSku);
                console.log('PDF report generated and processed successfully.');

                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>



                //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                //- STEP 6 --> send email to the client contact with the report

                await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'send final report', stepStatus: 'started', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

                var assessmentDetailsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessFinalResultId);
                assessmentDetailsId = assessmentDetailsId[0].id
                logger.info(`assessmentDetailsId = ${assessmentDetailsId}`);

                const genReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsId, 'Value');
                const genReportStatus = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsId, 'Status');
                logger.info(`genReport = ${genReport}`);
                logger.info(`genReportStatus = ${genReportStatus}`);

                if (genReportStatus == 'approved') { // --> this means we can send the email to the client

                    //THIS NEEDS MORE WORK AT THE END...

                    logger.info(`companyName = ${companyDetails.companyName}`);

                    const contactFirstName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactFirstName (from CompanyID)');
                    const contactLastName = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactLastName (from CompanyID)');
                    const contactEmail = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, '*PrimaryContactEmail (from CompanyID)');

                    var emailSubject = emails.genReportEmailSubject;
                    var emailContent = emails.genReportEmailContent;

                    // Generate the email body using the emailBodyMaker service
                    var emailBody = await replacePlaceholders.generateContent(isFilePath = true, 'email_client', { MESSAGE_BODY: emailContent, COMPANY_NAME: companyDetails.companyName, CONTACT_FIRSTNAME: contactFirstName, CONTACT_LASTNAME: contactLastName });

                    // Send the email 
                    await sendEmail(contactEmail, emailSubject, emailBody);

                    // log the step
                    await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: 'Email sent to the client', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: { contactFirstName, contactLastName, contactEmail } });


                    logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                    await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: '3rd branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
                    break;

                } else {
                    logger.yay(`entering the branch for a new assessment with assessmentStatus = ${assessmentStatus}`);
                    await logFlowTracking({ flowName: flowName, flowStatus: 'In Progress', flowStep: '3rd branch', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });
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
