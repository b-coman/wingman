// Filename: /src/services/processQuestionsBasedOnSignals.js

require('dotenv').config();
const { appConfig } = require('../../config');
const airtableUtils = require('../lib/airtableUtils');
const peopleUtils = require('../lib/peopleUtils');
const logger = require('../../logger');
const logFlowTracking = require('./flowTrackingService');
const CreateFormService = require('./createFormService');

//const wingmanAgentsService = require('./wingmanAgentsService');
//const replacePlaceholders = require('./replacePlaceholders');
//const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');
//const assetsUtils = require('../lib/knowledgeModelUtils');


// select all questions that matches with the identified signals for a certain assessemnt
async function processQuestionsToSurvey(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {
        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where questions are stored
        var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
        assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id;
        // logger.debug(`AssessmentDetails ID for questions: ${assessmentDetailsForQuestionsId}`);

        // find the record ID in table AssessmentDetails where surveys are stored
        var assessmentDetailsForSurveyId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSurveyId);
        assessmentDetailsForSurveyId = assessmentDetailsForSurveyId[0].id;
        // logger.debug(`AssessmentDetails ID for surveys: ${assessmentDetailsForSurveyId}`);

        // get the questions IDs from AssessmentDetails
        const assessmentDetailQuestionRecordIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForQuestionsId, 'AssessmentDetails:Questions');

        // create an entry in the Survey table
        const surveyRecordId = await airtableUtils.createRecord('Surveys', { 'AssessmentID': [assessmentRecordId] });

        // Iterate through the filtered questions and add them to the payload
        const formQuestionFields = { fields: [] }; // Initialize payload with fields array to push into

        for (const assessmentDetailQuestionRecordId of assessmentDetailQuestionRecordIDs) {
            try {
                // Fetch the reformulated question statement
                const questionReformulatedStatement = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'ReformulatedQuestionStatement');

                // Fetch the question record ID
                let questionRecordId = await airtableUtils.findFieldValueByRecordId('AssessmentDetails:Questions', assessmentDetailQuestionRecordId, 'QuestionID');
                questionRecordId = questionRecordId[0]; // Ensure this is correctly fetching the first element if it's returned as an array

                // Fetch the full question data
                const questionData = await airtableUtils.getFieldsForRecordById('Questions', questionRecordId);

                // Create a new field object based on the fetched data
                const formQuestionField = {
                    ref: questionData['QuestionSKU'],
                    title: questionReformulatedStatement,
                    type: questionData['AnswerType'],
                    properties: {}
                };

                // add question properties if is a rating type
                if (questionData['AnswerType'] === "rating") {
                    formQuestionField.properties.description = questionData['Description'];
                    formQuestionField.properties.shape = "star";
                    formQuestionField.properties.steps = questionData['RatingScale'];
                }

                // Append the new field object to the payload fields array
                formQuestionFields.fields.push(formQuestionField);

                // Insert question in Surveys:Questions if needed
                await airtableUtils.createRecord('Surveys:Questions', { 'SurveyID': [surveyRecordId], 'QuestionID': [questionRecordId], 'form_question_body': questionReformulatedStatement });

            } catch (error) {
                // Log any errors that occur during the process
                logger.error(`Error fetching data for question record ID ${assessmentDetailQuestionRecordId}: ${error}`);
            }
        }
        logger.info(JSON.stringify(formQuestionFields, null, 2));


        // start creating the form in Typeform
        const formName = "Short survey - initial reserach";
        const formDescription = "this is our first survey, please provide your initial feedback";

        // create the TYPEFORM --> Create an instance of the service
        const formService = new CreateFormService();

        // Call the createForm method
        const typeformResult = await formService.createForm(formName, formDescription, formQuestionFields);
        const typeformUrl = typeformResult.formUrl;
        const typeformId = typeformResult.formId;
        console.log("Form Created Successfully:", typeformResult);

        // update the Survey table with just created form data
        await airtableUtils.updateRecordField('Surveys', surveyRecordId, 'formURL', typeformUrl);
        await airtableUtils.updateRecordField('Surveys', surveyRecordId, 'formID', typeformId);

        // assign survey to a contact, create an entry in Surveys:Contacts table
        const contactRecordId = await peopleUtils.findPrimaryContactID(engagementRecordId);
        await airtableUtils.createRecord('Surveys:Contacts', { 'SurveyID': [surveyRecordId], 'ContactID': [contactRecordId] });

        // update the status for the current assessment
        //await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'survey created');

        logger.yay('Survey created successfully.');

        return { surveyRecordId, typeformUrl, typeformId };

    } catch (error) {
        logger.error('An error occurred during survey processing:', error);
    };

}

module.exports = { processQuestionsToSurvey };
