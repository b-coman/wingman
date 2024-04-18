// Filename: /src/services/wingmanAgentsService.js

const { agents } = require('../../config');
const axios = require('axios');
const logger = require('../../logger');
const { jsonrepair } = require('jsonrepair');
const { validateJson } = require('./jsonValidationService');  

async function callAgent(crewPayload) {
    let urlEndpoint = `${agents.agentsBaseURL}`;
    let configAxios = {
        method: 'post',
        url: urlEndpoint,
        headers: { 'Content-Type': 'application/json' },
        data: crewPayload,
        timeout: 600000
    };

    const response = await axios.request(configAxios);

    // Check if 'result' is a string and parse it if necessary
    if (typeof response.data.result === 'string') {
        response.data.result = JSON.parse(response.data.result);
        logger.info('Result parsed successfully.');
    }
    
    return response.data;
}

async function callWingmanAgents(crewPayload, schemaPath, maxRetries = 3) {

    crewPayload = jsonrepair(crewPayload);
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        try {
            logger.info(`Attempt ${attempt}: Sending request to agent.`);
            const response = await callAgent(crewPayload);

            // Validate the response after it has been potentially parsed
            const validationResult = await validateJson(response, schemaPath);
            if (validationResult.valid) {
                logger.yay(`Attempt ${attempt}: Response is valid and successfully processed by agents.`);
                return response;
            } else {
                logger.error(`Validation failed on attempt ${attempt}: ${JSON.stringify(validationResult.errors)}`);
            }
        } catch (error) {
            logger.error(`Attempt ${attempt}: Request failed: ${error.message}`);
            if (attempt >= maxRetries) {
                throw new Error(`Failed after ${maxRetries} attempts due to errors: ${error.message}`);
            }
        }
    }

    throw new Error('Failed to obtain a valid response after retries.');
}

module.exports = { callWingmanAgents }





// exports.callWingmanAgentsApp = async (crewPayload) => {
//     //repairs json if needed
//     crewPayload = jsonrepair(crewPayload);

//     let urlEndpoint = `${agents.agentsBaseURL}`;
//     let configAxios = {
//         method: 'post',
//         url: urlEndpoint,
//         headers: { 'Content-Type': 'application/json' },
//         data: crewPayload,
//         timeout: 600000
//     };

//     try {
//         const response = await axios.request(configAxios);

//         // Check if 'result' is a string and parse it if necessary
//         if (typeof response.data.result === 'string') {
//             try {
//                 response.data.result = JSON.parse(response.data.result);
//                 logger.info('Result parsed successfully.');
//             } catch (error) {
//                 logger.error('Failed to parse result:', error.message);
//                 // Handle parse error (e.g., log, throw an error, etc.)
//                 throw new Error('Failed to parse result: ' + error.message); // Optionally re-throw or handle it differently
//             }
//         }

//         // Here, use parsedResult which should now be an array
//         if (response.data.status === 'success') {
//             logger.yay(`Successfully processed by agents, good response received`);
//         } else {
//             logger.error(`Processing failed. --> ${response.data}`);
//         }

//         return response.data;

//     } catch (error) {
//         console.error('Axios Request Failed:', error);
//         throw error; // Rethrow or handle the error as appropriate
//     }
// }

