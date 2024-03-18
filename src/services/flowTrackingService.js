// /src/services/flowTrackingService.js

const logger = require('../../logger');
const airtableUtils = require('../lib/airtableUtils');

// Adjusting the function to directly export the required functionality
module.exports = async ({ flowName, flowStatus, flowStep, stepStatus, timestamp, engagementId = null, assessmentId = null, additionalInfo = {} }) => {
  // Construct the log message
  const logMessage = `Flow tracking log --> Flow: ${flowName}, Status: ${flowStatus}, Step: ${flowStep}, Step Status: ${stepStatus}`;
  
  // Log data includes additionalInfo spread into the object
  const logData = { engagementId, assessmentId, ...additionalInfo };

  // Log with Winston
  logger.info(logMessage, logData);

  try {
    // Ensure flowStatus matches the single select field options in Airtable
    const validFlowStatus = ['Started', 'In Progress', 'Completed'].includes(flowStatus) ? flowStatus : 'In Progress';
    
    // Prepare the Airtable record update/creation, handling linked fields and single select fields
    await airtableUtils.updateFlowStatus({
      flowName, 
      flowStatus: validFlowStatus, 
      flowStep, 
      stepStatus, 
      timestamp, 
      engagementId, 
      assessmentId,
      additionalInfo
    });
  } catch (error) {
    // Log errors with Winston, including the original log message for context
    logger.error(`Failed to log flow status for ${logMessage}`, { error: error.toString(), ...logData });
  }
};
