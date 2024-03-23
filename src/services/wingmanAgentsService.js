// Filename: /src/services/wingmanAgentsService.js

const {agents} = require('../../config');
const axios = require('axios');
const logger = require('../../logger'); // Ensure the path to your logger is correct
const { log } = require('winston');


exports.callWingmanAgentsApp = async (crewName, taskDescription, taskPrompt, route) => {
    let data = JSON.stringify({
        description: taskDescription,
        expected_output: taskPrompt,
    });

    let urlEndpoint = `${agents.agentsBaseURL}${route}`;
    let configAxios = {
        method: 'post',
        maxBodyLength: Infinity,
        url: urlEndpoint,
        headers: { 
            'Content-Type': 'application/json'
        },
        data: data,
        timeout: 600000
    };

    try {
        const response = await axios.request(configAxios);

        // Assuming 'result' is a properly formatted JSON string within `response.data`
        // and needs parsing to be used as an array.
        const parsedResult = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

        // Here, use parsedResult which should now be an array
        if (response.data.status === 'success') {
            logger.info(`Successfully processed response for ${crewName}: ${JSON.stringify(parsedResult)}`);
        } else {
            logger.error(`Processing failed for ${crewName}: ${response.data}`);
        }

        return parsedResult; // or adjust based on your needs
    } catch (error) {
        logger.error(`Error calling wingman-agents app for ${crewName}: ${error}`);
        throw error; // Rethrow or handle the error as appropriate
    }
}

