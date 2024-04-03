// /src/lib/airtableUtils.js

require('dotenv').config();
const Airtable = require('airtable');
const logger = require('../../logger');

Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);


// -------------- COMPANY check/create 
/**
 * Checks for an existing company by name and domain or creates a new one in Airtable.
 * @param {string} companyName - The name of the company.
 * @param {string} companyDomain - The domain of the company.
 * @returns {Promise<string>} The ID of the existing or newly created company.
 */

exports.checkOrCreateCompany = async (companyName, companyDomain) => {
    const companyTable = base('Companies');
    try {
        // Search for existing company by name and domain
        const records = await companyTable.select({
            filterByFormula: `AND({CompanyName} = '${companyName}', {CompanyDomain} = '${companyDomain}')`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            // Company exists, return its ID
            return records[0].getId();
        } else {
            // Company does not exist, create a new one
            const createdRecords = await companyTable.create([{
                fields: {
                    'CompanyName': companyName,
                    'CompanyDomain': companyDomain,
                    'CompanyCurrentFlowStage': 'registration' // Adjust field names as necessary
                }
            }]);
            // Return new company's ID
            return createdRecords[0].getId();
        }
    } catch (error) {
        console.error('Error in checkOrCreateCompany:', error);
        throw error; // Re-throw the error to handle it in the calling function
    }
};


// -------------- CONTACT check/create 

exports.checkOrCreateContact = async (CompanyID, ContactFirstName, ContactLastName, ContactEmail, ContactType) => {
    const contactsTable = base('Contacts'); // Adjust 'Contacts' if your table name is different
    try {
        // Search for existing contact by email
        const records = await contactsTable.select({
            filterByFormula: `{ContactEmail} = '${ContactEmail}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            // Contact exists, return its ID
            return records[0].getId();
        } else {
            // Contact does not exist, create a new one
            const createdRecords = await contactsTable.create([{
                fields: {
                    'ContactFirstName': ContactFirstName,
                    'ContactLastName': ContactLastName,
                    'ContactEmail': ContactEmail,
                    'ContactType': 'primary',
                    'CompanyID': [CompanyID] // Assumes 'Company' is a linked record field to 'Companies' table
                }
            }]);
            // Return new contact's ID
            return createdRecords[0].getId();
        }
    } catch (error) {
        console.error('Error in checkOrCreateContact:', error);
        throw error;
    }
};


// -------------- ENGAGEMENT create 
exports.createEngagement = async (companyId, sourceIdentifier, engagementInitialContext) => {
    const engagementsTable = base('Engagements');
    try {
        // Use the generic function to find the actual Airtable record ID for the source
        const sourceId = await exports.findRecordIdByIdentifier('WingmanSources', 'SourceID', sourceIdentifier);

        // Find the Airtable record ID for the Engagement Type "WET-002"
        // !! envDeafultEngagementType is set in .env file
        const engagementTypeId = await exports.findRecordIdByIdentifier('WingmanEngagementTypes', 'EngagementTypeID', process.env.envDeafultEngagementType);

        // Create a new engagement record with the resolved sourceId and engagementTypeId
        const createdRecords = await engagementsTable.create([{
            fields: {
                'CompanyID': [companyId],
                'SourceID': [sourceId],
                'EngagementTypeID': [engagementTypeId], // Set the EngagementTypeID field
                'EngagementInitialContext': engagementInitialContext,
                "Timestamp": new Date().toISOString(),
                // Add other necessary fields here
            }
        }]);
        // Return new engagement's ID
        return createdRecords[0].getId();
    } catch (error) {
        console.error('Error in createEngagement:', error);
        throw error; // Propagate the error for external handling
    }
};


exports.findEngagementSourceOwnerUserId = async (sourceId) => {
    const wingmanSourcesTable = base('WingmanSources');
    try {
        const records = await wingmanSourcesTable.select({
            filterByFormula: `{SourceID} = '${sourceId}'`
        }).firstPage();

        if (records.length > 0 && records[0].fields.EngagementSourceOwner) {
            // Assuming EngagementSourceOwner links directly to a single UserID
            return records[0].fields.EngagementSourceOwner[0];
        } else {
            throw new Error('Engagement source owner not found.');
        }
    } catch (error) {
        console.error('Error finding engagement source owner UserID:', error);
        throw error;
    }
};


exports.findUserEmailByUserId = async (userId) => {
    const usersTable = base('Users');
    try {
        const record = await usersTable.find(userId);
        if (record && record.fields.UserEmail) {
            return record.fields.UserEmail;
        } else {
            throw new Error('User email not found.');
        }
    } catch (error) {
        console.error('Error finding user email:', error);
        throw error;
    }
};


exports.insertEngagementPrompt = async (engagementId, statement, description, confidenceScore) => {
    const engagementPromptsTable = base('EngagementPrompts');
    try {
        await engagementPromptsTable.create([{
            fields: {
                'EngagementID': [engagementId],
                'EngagementPromptStatement': statement,
                'EngagementPromptDescription': description,
                'EngagementPromptConfidence': confidenceScore,
                'EngagementPromptStatus': 'pending',
            }
        }]);
        logger.info('Engagement prompt inserted successfully.');
    } catch (error) {
        logger.error('Error inserting engagement prompt:', error);
        throw error;
    }
};

exports.createAgentActivityRecord = async (companyID, crewName, taskDescription, taskPrompt) => {
    const table = base('_agentRuns');
    try {
        const createResponse = await table.create({
            "CompanyID": [companyID], // Notice that companyID is now inside an array
            "CrewName": crewName,
            "TaskDescription": taskDescription,
            "TaskPrompt": taskPrompt,
            "Timestamp": new Date().toISOString() // Or format it according to your needs
        });

        // Return the ID of the newly created record to be used as the 'runID'
        return createResponse.getId();
    } catch (error) {
        console.error('Error creating agent activity record:', error);
        throw error;
    }
};

exports.updateAgentActivityRecord = async (runID, output) => {
    const table = base('_agentRuns');
    const stringOutput = JSON.stringify(output);

    try {
        await table.update(runID, { "runOutput": stringOutput });
    } catch (error) {
        console.error('Error updating agent activity record:', error);
        throw error;
    }
};



// handle the insert for flow tracking
exports.updateFlowStatus = async ({ flowName, flowStatus, flowStep, stepStatus, timestamp, engagementId = null, assessmentId = null, additionalInfo = {} }) => {
    const table = base('FlowTracking'); // Adjust with the correct table name as needed

    // Initialize the fields object with the data to be sent to Airtable
    const fields = {
        FlowName: flowName,
        FlowStatus: flowStatus,
        FlowStep: flowStep,
        StepStatus: stepStatus,
        Timestamp: timestamp,
        // Conditionally add engagementId and assessmentId only if they are provided
        ...(engagementId && { EngagementID: [engagementId] }),
        ...(assessmentId && { AssessmentID: [assessmentId] }),
        // AdditionalInfo needs to be a string or structured in a way Airtable expects
        AdditionalInfo: JSON.stringify(additionalInfo)
    };

    //logger.info(`Logging engagementId: ${engagementId}`);

    try {
        // Create a new record in the FlowTracking table with the specified fields
        const record = await table.create(fields); // Note: 'fields' is passed directly
        //logger.info('Flow status updated successfully in Airtable:', record.getId());
        return record.getId();
    } catch (error) {
        logger.error('Error creating or updating record in Airtable:', error);
        throw error;
    }
};


// Function to fetch the assessment type name by assessment ID from Airtable
exports.getAssessmentTypeById = async (assessmentId) => {
    logger.info(`Fetching AssessmentType for AssessmentID: ${assessmentId}`);
    let assessmentRecord, assessmentTypeId;
    try {
        // Fetch the assessment to get its AssessmentTypeID
        assessmentRecord = await base('Assessments').find(assessmentId);
        assessmentTypeId = assessmentRecord.fields.AssessmentTypeID;

        if (!assessmentTypeId || assessmentTypeId.length === 0) {
            logger.error(`AssessmentTypeID not found for AssessmentID: ${assessmentId}`);
            throw new Error(`AssessmentTypeID not found for AssessmentID: ${assessmentId}`);
        }

        // Fetch the AssessmentTypeName from WingmanAssessmentTypes using the AssessmentTypeID
        // Note: Assuming the linked field returns an array of IDs, we take the first one
        const typeId = assessmentTypeId[0]; // Adjust if your setup might include multiple IDs
        const typeRecord = await base('WingmanAssessmentTypes').find(typeId);
        const assessmentTypeName = typeRecord.fields.AssessmentTypeName;

        logger.info(`Fetched AssessmentTypeName: ${assessmentTypeName} for AssessmentID: ${assessmentId} with TypeID: ${typeId}`);
        return assessmentTypeName;
    } catch (error) {
        logger.error(`Error fetching AssessmentTypeName for AssessmentID ${assessmentId}: ${error}`);
        throw error;
    }
}

// identify the place where the raw result returned by general assess agent will be placed
exports.findAssessDetailsByAssessIDAndTemplate = async (assessmentId, templateValue) => {
    const table = base('AssessmentDetails');

    try {
        const records = await table.select({
            filterByFormula: `AND({AssessmentID} = '${assessmentId}', FIND('${templateValue}', {WingmanAssessmentItemsTemplate (from AssessmentItemID)}))`
        }).firstPage();
        // Map the records to extract the Airtable record ID and fields
        const mappedRecords = records.map(record => {
            return {
                id: record.id, // This is the Airtable-generated record ID starting with "rec"
                ...record.fields // Spread all fields into the result object
            };
        });

        return mappedRecords;
    } catch (error) {
        console.error('Error querying AssessmentDetails:', error);
        throw error;
    }
};



/**
 * Fetches data from the "Pains" table and returns it in a JSON format with specific fields.
 * @returns {Promise<Array>} An array of objects each containing id, PainSKU, and PainStatement.
 */
exports.fetchPainsData = async () => {
    const table = base('Pains');
    const painsData = [];
    await table.select({
        // Specify any filters if needed, such as fields to retrieve or sorting
    }).eachPage((records, fetchNextPage) => {
        records.forEach(record => {
            painsData.push({
                recordID: record.id,
                PainSKU: record.get('PainSKU'),
                PainStatement: record.get('PainStatement')
            });
        });
        fetchNextPage();
    });

    return painsData;
};


exports.findPainRecordIdBySKU = async (painSKU) => {
    const table = base('Pains');
    try {
        const records = await table.select({
            filterByFormula: `{PainSKU} = '${painSKU}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            return records[0].id; // Return the first record's ID
        } else {
            throw new Error(`No record found with PainSKU: ${painSKU}`);
        }
    } catch (error) {
        logger.error(`Error finding record by PainSKU: ${painSKU}: ${error}`);
        throw error;
    }
};


/**
 * Creates entries in the AssessmentDetails:Pains table for each item in the agent's response.
 * @param {Array} agentResponseResult - The response from the agent as an array of objects.
 * @param {String} assessmentDetailsId - The ID for the AssessmentDetail linked to these entries.
 * @returns {Promise<void>}
 */
exports.createPainAssessmentDetails = async (agentResponseResult, assessmentDetailsId, runID) => {
    const assessmentDetailsPainsTable = base('AssessmentDetails:Pains');

    // Define a regex for painSKU format validation
    const painSKURegex = /^P-\d{2}$/;

    // Iterate through each result item
    for (const item of agentResponseResult) {
        try {
            // Validate painSKU format
            if (!painSKURegex.test(item.painSKU)) {
                throw new Error(`Invalid painSKU format: ${item.painSKU}`);
            }

            const painRecordID = await exports.findPainRecordIdBySKU(item.painSKU); // Lookup the PainID using the painSKU
            const confidenceScore = parseFloat(item.confidenceScore); // Convert to number

            await assessmentDetailsPainsTable.create({
                'AssessmentDetailID': [assessmentDetailsId],
                'PainID': [painRecordID],
                'ConfidenceScore': confidenceScore,
                'Reason': item.reasoning,
                'AgentRunID': [runID]
            });

            //logger.info(`Entry created with PainSKU: ${item.painSKU}`);
        } catch (error) {
            logger.error(`Error creating entry with PainSKU: ${item.painSKU}: ${error}`);
            console.error(error);
        }
    }
};



/**
 * Creates entries in the AssessmentDetails:Signals table for each item in the agent's response.
 * @param {Array} agentResponseResult - The response from the agent as an array of objects.
 * @param {String} assessmentDetailsId - The ID for the AssessmentDetail linked to these entries.
 * @returns {Promise<void>}
 */
exports.createSignalAssessmentDetails = async (agentResponseResult, assessmentDetailsId, runID) => {
    const assessmentDetailsSignalsTable = base('AssessmentDetails:Signals');

    // Iterate through each result item
    for (const item of agentResponseResult) {
        try {
            const signalRecordID = item.SignalRecordId; 
            const reasoning = item.reasoning;
            const confidenceScore = parseFloat(item.confidenceScore); // Convert to number

            await assessmentDetailsSignalsTable.create({
                'AssessmentDetailID': [assessmentDetailsId],
                'SignalID': [signalRecordID],
                'ConfidenceScore': confidenceScore,
                'Reason': reasoning,
                'AgentRunID': [runID]
            });
           // logger.info(`Entry created with Signal ID: ${signalRecordID}`);

        } catch (error) {
            logger.error(`Error creating entry with Signal ID: ${assessmentDetailsId}: ${error}`);
            console.error(error);
        }
    }
};



// Function to get an entry from the 'AssessmentDetails:FinalReport' table by AssessmentDetailID
exports.getFinalReportEntry = async (assessmentDetailsId) => {
    const table = base('AssessmentDetails:FinalReport');
    try {
        const records = await table.select({
            filterByFormula: `{AssessmentDetailID} = '${[assessmentDetailsId]}'`,
            maxRecords: 1
        }).firstPage();
        logger.info(`getFinalReportEntry: ${records.length}`);
        return records.length > 0 ? records[0] : null;
    } catch (error) {
        console.error('Error in getFinalReportEntry:', error);
        throw error;
    }
};

// Function to update an entry in the 'AssessmentDetails:FinalReport' table
exports.updateFinalReportEntry = async (recordToUpdate, assessmentDetailsId, markdownContent, htmlContent, pdfFileName, pdfFileURL) => {
    const table = base('AssessmentDetails:FinalReport');
    try {
        const updatedRecord = await table.update(recordToUpdate, {
            'AssessmentDetailID': [assessmentDetailsId],
            'ReportContentMarkdown': markdownContent,
            'ReportContentHTML': htmlContent,
            'ReportPDFfileName': pdfFileName,
            'ReportPDFURL': pdfFileURL
        });
        return updatedRecord;
    } catch (error) {
        console.error('Error in updateFinalReportEntry:', error);
        throw error;
    }
};

// Function to create a new entry in the 'AssessmentDetails:FinalReport' table
exports.createFinalReportEntry = async (assessmentDetailsId, markdownContent, htmlContent, pdfFileName, pdfFileURL) => {
    const table = base('AssessmentDetails:FinalReport');
    try {
        const createdRecord = await table.create({
            'AssessmentDetailID': [assessmentDetailsId],
            'ReportContentMarkdown': markdownContent,
            'ReportContentHTML': htmlContent,
            'ReportPDFfileName': pdfFileName,
            'ReportPDFURL': pdfFileURL
        });
        return createdRecord;
    } catch (error) {
        console.error('Error in createFinalReportEntry:', error);
        throw error;
    }
};


/**
 * Fetches signals from 'painsXsignals' table that are linked to a specific pain ID.
 * @param {string} painId - The ID of the pain record to find related signals for.
 * @returns {Promise<Array>} A promise that resolves to an array of records from 'painsXsignals' linked to the painId.
 */
exports.fetchRelatedSignalsForPain = async (painRecordId) => {

// indentify the pain ID in the Pains table for the painRecordId
const painId = await this.findFieldValueByRecordId('Pains', painRecordId, 'PainID');

    let signalIDs = [];
    try {
      const records = await base('painsXsignals').select({
        filterByFormula: `{PainID} = '${painId}'`
      }).all(); // Fetch all records that match the painID
  
      records.forEach(record => {
        if (record.fields.SignalID) {
          // Assuming SignalID is an array of linked record IDs
          signalIDs = signalIDs.concat(record.fields.SignalID);
        }
      });
  
    } catch (error) {
      logger.error(`Error fetching signals for Pain ID ${painId}:`, error);
    }
  
    return signalIDs; // Array of Signal IDs linked to the given Pain ID
  }



/** --> similaarly to the above functions, this fetches questions related to a signal
 * Fetches questions from 'signalsXquestions' table that are linked to a specific signal ID.
 * @param {string} signalRecordId - The ID of the signal record to find related questions for.
 * @returns {Promise<Array>} A promise that resolves to an array of records from 'signalsXquestions' linked to the signalId.
 */
exports.fetchRelatedQuestionsForSignal = async (signalRecordId) => {

    // indentify the pain ID in the Pains table for the painRecordId
    const signalId = await this.findFieldValueByRecordId('Signals', signalRecordId, 'SignalID');
    
        let questionIDs = [];
        try {
          const records = await base('signalsXquestions').select({
            filterByFormula: `{SignalID} = '${signalId}'`
          }).all(); // Fetch all records that match the signalID
      
          records.forEach(record => {
            if (record.fields.QuestionID) {
              // Assuming QuestionID is an array of linked record IDs
              questionIDs = questionIDs.concat(record.fields.QuestionID);
            }
          });
      
        } catch (error) {
          logger.error(`Error fetching signals for Pain ID ${signalId}:`, error);
        }
      
        return questionIDs; // Array of Signal IDs linked to the given Pain ID
      }
    



//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

//------------- FIND --> IMPORTANT (reuse everytime possible)!! Generic function to extract all fields and values for a record based on its primary key
// exports.getAllFieldsForRecord = async (tableName, primaryKeyField, primaryKeyValue) => {
//     const table = base(tableName);
//     try {
//         const records = await table.select({
//             filterByFormula: `{${primaryKeyField}} = '${primaryKeyValue}'`
//         }).firstPage();

//         if (records.length > 0) {
//             // Return the fields of the first matching record
//             return records[0].fields;
//         } else {
//             // No record found
//             console.log(`No record found with ${primaryKeyField} = ${primaryKeyValue} in ${tableName}`);
//             return null;
//         }
//     } catch (error) {
//         console.error('Error retrieving record from Airtable:', error);
//         throw error;
//     }
// };

exports.getFieldsForRecordById = async (tableName, recordId) => {
    const table = base(tableName);
    try {
        // Directly find the record by its ID
        const record = await table.find(recordId);

        if (record) {
            // Return the fields of the found record
            return record.fields;
        } else {
            // No record found
            console.log(`No record found with ID ${recordId} in ${tableName}`);
            return null;
        }
    } catch (error) {
        console.error('Error retrieving record from Airtable by ID:', error);
        throw error;
    }
};



//------------- FIND --> two IMPORTANT functions below (reuse everytime possible)

// Function to find a the value of a certain field based on the value of the primary key (e.g. email address)
exports.findRecordIdByIdentifier = async (tableName, fieldName, identifier) => {
    const targetTable = base(tableName);
    try {
        const records = await targetTable.select({
            filterByFormula: `{${fieldName}} = '${identifier}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            return records[0].id; // Return the Airtable record ID of the matched record
        } else {
            throw new Error(`Record with identifier ${identifier} not found in ${tableName}.`);
        }
    } catch (error) {
        console.error(`Error finding record ID in ${tableName}:`, error);
        throw error;
    }
};

// Function to find the value of a certain field based on the Airtable record ID
exports.findFieldValueByRecordId = async (tableName, recordId, fieldName) => {
    const targetTable = base(tableName);
    try {
        const record = await targetTable.find(recordId);

        if (record && record.fields[fieldName]) {
            return record.fields[fieldName]; // Return the value of the specified field
        } else {
            return null; // Return null if the record or field does not exist
            //throw new Error(`Field ${fieldName} not found for Record ID: ${recordId} in ${tableName}.`);
        }
    } catch (error) {
        console.error(`Error finding field value by Record ID in ${tableName}:`, error);
        throw error;
    }
};



/**
 * --------------------- IMPORTANT Function --> generic function for uptating a single field value in a record.
 * 
 * @param {String} tableName - The name of the table to update.
 * @param {String} recordId - The ID of the record to update.
 * @param {Object} fieldName - An object containing field names and their new values.
 * @param {String} newValue - The new value of the field to update.
 * @returns {Promise<Object>} - The updated record object.
 */
exports.updateRecordField = async (tableName, recordId, fieldName, newValue) => {
    const table = base(tableName);
    try {
        // Construct the update object dynamically using the fieldName
        const updateObject = {};
        updateObject[fieldName] = newValue;

        // Perform the update operation
        const updatedRecord = await table.update(recordId, updateObject);
        //console.log('Record updated successfully:', updatedRecord);
        return updatedRecord;
    } catch (error) {
        console.error('Error updating record:', error);
        throw error;
    }
};

