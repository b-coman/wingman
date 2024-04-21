// Filename: /src/services/processQuestionsBasedOnSignals.js

require('dotenv').config();
const { appConfig } = require('../../config');
const airtableUtils = require('../lib/airtableUtils');
const peopleUtils = require('../lib/peopleUtils');
const assetsUtils = require('../lib/knowledgeModelUtils');
const logger = require('../../logger');
const logFlowTracking = require('./flowTrackingService');
const wingmanAgentsService = require('./wingmanAgentsService');
const replacePlaceholders = require('./replacePlaceholders');
const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');
const CreateFormService = require('./createFormService');


// select all questions that matches with the identified signals for a certain assessemnt
async function processQuestionsToSurvey(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {
        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where questions are stored
        var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
        assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id;
        logger.debug(`AssessmentDetails ID for questions: ${assessmentDetailsForQuestionsId}`);

        // find the record ID in table AssessmentDetails where surveys are stored
        var assessmentDetailsForSurveyId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSurveyId);
        assessmentDetailsForSurveyId = assessmentDetailsForSurveyId[0].id;
        logger.debug(`AssessmentDetails ID for surveys: ${assessmentDetailsForSurveyId}`);

        // get the questions IDs from AssessmentDetails
        const assessmentDetailQuestionRecordIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForQuestionsId, 'AssessmentDetails:Questions');
        logger.debug(JSON.stringify(assessmentDetailQuestionRecordIDs, null, 2));



        //construct the object that store details about questions
        const questionsData = [];
        for (const assessmentDetailQuestionRecordId of assessmentDetailQuestionRecordIDs) {
            try {
                const questionReformulatedStatement = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'ReformulatedQuestionStatement');
                var questionRecordId = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'QuestionID');
                questionRecordId = questionRecordId[0];
                const questionData = await airtableUtils.getFieldsForRecordById('Questions', questionRecordId);
                const aggregatedQuestionData = {
                    questionRecordId: questionRecordId,
                    questionSKU: questionData['QuestionSKU'],
                    questionBody: questionReformulatedStatement,
                    questionDescriptions: questionData['Description'],
                    //  isQuantitative: questionData['isQuantitative']
                };
                questionsData.push(aggregatedQuestionData);
            } catch (error) {
                logger.error(`Error fetching data for question record ID ${assessmentDetailQuestionRecordId}: ${error}`);
            }
        }
        // serialiize question data
        var jsonQuestionsData = JSON.stringify(questionsData, null, 2);
        logger.debug(`Serialized questions data: \n${jsonQuestionsData}`);


        // Create an instance of the service
        const formService = new CreateFormService();

        // Example data
        const formName = "Example Form";
        const formDescription = "This is a sample form created via Typeform API";
        const questions = [
            {
                title: "How well do you feel project goals and objectives are communicated and aligned among product management, design, and engineering teams?",
                type: "rating",  // assuming 'rating' is a supported type in Typeform
                ref: "PPL-Q-10",
                properties: {
                    description: "Rate from 1 to 5",  // Additional properties as needed
                    steps: 5,  // Assuming 'steps' is a valid property for a 'rating' type
                    shape: "star"  // Assuming 'shape' is a valid property for a 'rating' type
                }
            },
            {
                title: "How clear are the roles and responsibilities within your team?",
                type: "rating",
                ref: "PPL-Q-02",
                properties: {
                    description: "Rate clarity of roles from 1 to 5",
                    steps: 5,
                    shape: "circle"
                }
            }
        ];
        
        try {
            // Call the createForm method
            const result = await formService.createForm(formName, formDescription, questions);
            console.log("Form Created Successfully:", result);
        } catch (error) {
            console.error("Failed to create form:", error);
        }

        return;

        //prepare the agent call, the additional details needed
        const companyName = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyName (from CompanyID) (from assignedToEngagement)');
        var companyRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyID (from assignedToEngagement)');
        companyRecordId = companyRecordId[0];



        //replace placeholders in the payload
        var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
            COMPANY: companyName,
            INITIAL_RESEARCH: jsonRawReport.replace(/"/g, '\\"'),
            SIGNALS_LIST: jsonSignalDescription.replace(/"/g, '\\"'),
            QUESTIONS_LIST: jsonQuestionsData.replace(/"/g, '\\"'),
            ROLE: jsonRoleDetails.replace(/"/g, '\\"')

        });

        logger.info(`Agent payload: \n${crewPayload}`);
        logger.warn("Now calling agent...");





        // make the update to AssessmentDetails with the agent result, and the status
        agentResponseResult = JSON.stringify(agentResponseResult)
        logger.info(`require approval: \n ${appConfig.questionRequireApproval}`)
        const assessmentDetailsStatus = appConfig.questionRequireApproval ? 'pending' : 'approved'; // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approava;
        await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessQuestionsId, assessmentDetailsStatus);

        // update the status for the current assessment
        await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'questions selected');

        logger.yay('Questions processing completed successfully.');

    } catch (error) {
        logger.error('An error occurred during survey processing:', error);
    };

}

module.exports = { processQuestionsToSurvey };
