// /src/lib/flowOutputsUtils.js

// here we keep all functions for:
// reports, selected questions, selected signals, selected pains

require('dotenv').config();
const airtableUtils = require('./airtableUtils'); // Adjust the path as needed
const logger = require('../../logger'); // Adjust the path as needed


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
  

  