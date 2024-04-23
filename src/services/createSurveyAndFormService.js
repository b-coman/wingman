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


        // create an entry in the Survey table
        const surveyRecordId = await airtableUtils.createRecord('Surveys', { 'AssessmentID': [assessmentRecordId] });
        //const surveyRecordId = surveyCreated.id;
        logger.debug(`Survey record created with ID: ${surveyRecordId}`);

        //construct the object that store details about questions
        const questionsData = [];
        for (const assessmentDetailQuestionRecordId of assessmentDetailQuestionRecordIDs) {
            try {
                const questionReformulatedStatement = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'ReformulatedQuestionStatement');
                var questionRecordId = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'QuestionID');
                questionRecordId = questionRecordId[0];
                const questionData = await airtableUtils.getFieldsForRecordById('Questions', questionRecordId);
                const aggregatedQuestionData = {
                    title: questionReformulatedStatement,
                    type: questionData['AnswerType'],
                    ref: questionData['QuestionSKU'],
                    properties: {
                        description: questionData['Description']
                    }
                };
                questionsData.push(aggregatedQuestionData);

                // insert question in Surveys:Questions
                await airtableUtils.createRecord('Surveys:Questions', { 'SurveyID': [surveyRecordId], 'QuestionID': [questionRecordId], 'form_question_body': questionReformulatedStatement });

            } catch (error) {
                logger.error(`Error fetching data for question record ID ${assessmentDetailQuestionRecordId}: ${error}`);
            }
        }
        // serialize question data
        var jsonQuestionsData = JSON.stringify(questionsData, null, 2);
        logger.debug(`Serialized questions data: \n${jsonQuestionsData}`);


        // Example data
        const formName = "Example Form";
        const formDescription = "This is a sample form created via Typeform API";


        // create the TYPEFORM --> Create an instance of the service
        const formService = new CreateFormService();


        // Call the createForm method
        const typeformResult = await formService.createForm(formName, formDescription, questionsData);
        const typeformUrl = typeformResult.formUrl;
        const typeformId = typeformResult.formId;
        console.log("Form Created Successfully:", typeformResult);


        // update the Survey table with form data
        await airtableUtils.updateRecordField('Surveys', surveyRecordId, 'formURL', typeformUrl);
        await airtableUtils.updateRecordField('Surveys', surveyRecordId, 'formID', typeformId);


        // assign survey to a contact, create an entry in Surveys:Contacts table
        const contactRecordId = await peopleUtils.findPrimaryContactID(engagementRecordId);
        await airtableUtils.createRecord('Surveys:Contacts', {'SurveyID': [surveyRecordId], 'ContactID': [contactRecordId]});

        // update the status for the current assessment
        //await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'survey created');

        logger.yay('Survey created successfully.');

        return {surveyRecordId, typeformUrl, typeformId};

    } catch (error) {
        logger.error('An error occurred during survey processing:', error);
    };

}

module.exports = { processQuestionsToSurvey };
