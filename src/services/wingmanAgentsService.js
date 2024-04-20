// Filename: /src/services/wingmanAgentsService.js

const { agents } = require('../../config');
const axios = require('axios');
const logger = require('../../logger');
const { jsonrepair } = require('jsonrepair');
const { validateJson } = require('./jsonValidationService');  

async function callAgent(crewPayload) {
    const urlEndpoint = `${agents.agentsBaseURL}`;
    const configAxios = {
        method: 'post',
        url: urlEndpoint,
        headers: { 'Content-Type': 'application/json' },
        data: crewPayload,
        timeout: 600000
    };

    const response = await axios.request(configAxios);
    // Simplify by only parsing JSON if the header explicitly states it's JSON
    if (response.headers['content-type']?.includes('application/json')) {
        if (typeof response.data === 'string') {
            response.data = JSON.parse(response.data);
            logger.info('Result parsed successfully.');
        }
    }

    return response.data;
}

async function callWingmanAgents(crewPayload, schemaPath = null, maxRetries = 3) {
    crewPayload = jsonrepair(crewPayload);
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        try {
            logger.info(`Attempt ${attempt}: Sending request to agent.`);
            const response = await callAgent(crewPayload);
            logger.info(`Response from agent: ${JSON.stringify(response)}`);

            if (schemaPath) {

                if (typeof response.result === 'string') {
                    try {
                        response.result = JSON.parse(response.result);
                        logger.info('Result parsed successfully into an object.');
logger.info(response.result);
                    } catch (error) {
                        logger.error(`Failed to parse 'result' from JSON string: ${error.message}`);
                        throw error;  // Optional: re-throw the error if you want to handle it further up the chain
                    }
                }

                const validationResult = await validateJson(response, schemaPath);
                if (!validationResult.valid) {
                    logger.error(`Validation failed on attempt ${attempt}: ${JSON.stringify(validationResult.errors)}`);
                    continue;  // Continue to the next retry
                }
            }

            logger.yay(`Attempt ${attempt}: Response is successfully processed by agents.`);
            return response;  // Successful processing
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

