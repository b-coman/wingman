// /src/lib/flowOutputsUtils.js

// here we keep all functions for:
// reports, selected questions, selected signals, selected pains

require('dotenv').config();
const Airtable = require('airtable');
const airtableUtils = require('./airtableUtils'); // Adjust the path as needed
const logger = require('../../logger');

Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY,
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);


exports.fetchReportContentForAssessment = async (assessmentId) => {
  try {
    // Fetch assessment details by assessment ID and template
    let assessmentDetails = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessFinalResultId);

    // Ensure there are details fetched and get the first item's ID
    if (assessmentDetails.length > 0) {
      const assessmentDetailsId = assessmentDetails[0].id;

      // Fetch the report content using the assessment details ID
      const reportContent = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsId, 'Value');

      // Return the report content
      return reportContent;
    } else {
      throw new Error('No assessment details found for the provided assessment ID and template.');
    }
  } catch (error) {
    // Log the error or handle it as needed
    console.error('Error fetching report content for assessment:', error);
    throw error; // Re-throw the error if you want to handle it further up the call stack
  }
}


exports.fetchPainReason = async (painId, assessmentDetailId) => {
  const targetTable = base('AssessmentDetails:Pains');

  try {
    // Correct the filterByFormula syntax and usage of fields array
    const records = await targetTable.select({
      // Properly format the filter formula and the fields array
      filterByFormula: `AND({PainID} = '${painId}', {AssessmentDetailID} = '${assessmentDetailId}')`,
      fields: ['Reason']  // fields should be an array of strings
    }).firstPage();

    if (records.length === 0) {
      return null;
    }

    const extractedValue = records[0].get('Reason');
    return extractedValue;
  } catch (error) {
    console.error('Error extracting field from AssessmentDetails:Pains:', error);
    throw error;
  }
}

exports.fetchSurveyDataByAssessmentID = async (assessmentRecordId) => {
  logger.warn('Fetching submission data ...');
  // Retrieve all surveys associated with the given AssessmentID
  const rawSurveyIds = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*Surveys');
  const surveyIds = Array.isArray(rawSurveyIds) ? rawSurveyIds : [];
  logger.info(`Fetched ${surveyIds.length} surveys associated with assessment ${assessmentRecordId}`);
  logger.info(`Surveys: ${JSON.stringify(surveyIds)}`);

  const surveys = [];

  for (let surveyId of surveyIds) {
    const survey = await airtableUtils.getFieldsForRecordById('Surveys', surveyId);
    survey.submissions = [];

    const rawSubmissionIds = await airtableUtils.findFieldValueByRecordId('Surveys', surveyId, '*Submissions');
    const submissionIds = Array.isArray(rawSubmissionIds) ? rawSubmissionIds : [];
    if (submissionIds.length === 0) {
      logger.warn(`No submissions found for survey ${surveyId}`);
      continue;  // Skip this survey if no submissions are found
    }

    for (let submissionId of submissionIds) {
      const submission = await airtableUtils.getFieldsForRecordById('Surveys:Submissions', submissionId);
      submission.responses = [];

      const rawResponseIds = await airtableUtils.findFieldValueByRecordId('Surveys:Submissions', submissionId, '*Responses');
      const responseIds = Array.isArray(rawResponseIds) ? rawResponseIds : [];
      if (responseIds.length === 0) {
        logger.warn(`No responses found for submission ${submissionId}`);
        continue;  // Skip this submission if no responses are found
      }

      for (let responseId of responseIds) {
        const response = {};
        const questionData = await airtableUtils.getFieldsForRecordById('Surveys:Submissions:Responses', responseId);
        if (!questionData) {
          logger.error(`Data for response ${responseId} could not be fetched.`);
          continue;  // Skip this response if data is null
        }
        const questionRecordId = questionData.QuestionID;
        const questionStatement = await airtableUtils.findFieldValueByRecordId('Questions', questionRecordId, 'QuestionStatement');
        const questionAnswerType = await airtableUtils.findFieldValueByRecordId('Questions', questionRecordId, 'AnswerType');
        const questionDescription = await airtableUtils.findFieldValueByRecordId('Questions', questionRecordId, 'Description');

        response.questionStatement = questionStatement;
        response.responseValue = questionData.ResponseValue;
        response.questionType = questionAnswerType;
        response.questionDescription = questionDescription;

        submission.responses.push(response);
      }

      survey.submissions.push(submission);
    }

    surveys.push(survey);
  }

  return surveys;
};
