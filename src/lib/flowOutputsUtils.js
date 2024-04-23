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
  const surveyIds = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*Surveys');
  logger.info(`Fetched ${surveyIds.length} surveys associated with assessment ${assessmentRecordId}`);
  logger.info(`Surveys: ${JSON.stringify(surveyIds)}`);

  const surveys = [];

  // Iterate over each survey ID to fetch detailed data
  for (let surveyId of surveyIds) {
    // Fetch the full survey record by ID
    const survey = await airtableUtils.getFieldsForRecordById('Surveys', surveyId);
    survey.submissions = [];

    // Retrieve all submission IDs linked to this survey
    const submissionIds = await airtableUtils.findFieldValueByRecordId('Surveys', surveyId, '*Submissions');

    // Iterate over each submission ID to fetch detailed data
    for (let submissionId of submissionIds) {
      const submission = await airtableUtils.getFieldsForRecordById('Surveys:Submissions', submissionId);
      submission.responses = [];

      // Retrieve all response IDs linked to this submission
      const responseIds = await airtableUtils.findFieldValueByRecordId('Surveys:Submissions', submissionId, '*Responses');

      // Iterate over each response ID to fetch detailed data
      for (let responseId of responseIds) {
        const response = await airtableUtils.getFieldsForRecordById('Surveys:Submissions:Responses', responseId);
        const questionId = response.QuestionID;
        const questionStatement = await airtableUtils.findFieldValueByRecordId('Questions', questionId, 'QuestionStatement');

        // Attach question statement and response value to the response object
        response.questionStatement = questionStatement;
        response.responseValue = response.ResponseValue;

        // Attach the detailed response object to the submission
        submission.responses.push(response);
      }

      // Attach the detailed submission object to the survey
      survey.submissions.push(submission);
    }

    // Attach the detailed survey object to the final list of surveys
    surveys.push(survey);
  }

  // Return the complete list of structured survey data
  // logger.info(`Final structured survey data: ${JSON.stringify(surveys)}`);
  return surveys;
}
