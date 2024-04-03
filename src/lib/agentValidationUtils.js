// /src/lib/agentValidationUtils.js
// here we keep all functions validating different aspects with the agents: pains, signals, questions in context of assessemnts

require('dotenv').config();
const agents = require('../../templates/agents.json');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const logger = require('../../logger');

/**
 * Analyzes questions with additional context using an analyst agent, incorporating retries for unmatched response formats.
 * 
 * @param {Array} questionsJson - An array of questions with structure: QuestionRecordId, QuestionStatement, QuestionDescription.
 * @param {Object} contextData - Any type of data that the agent will use to validate the questions, not only a report.
 * @returns {Array} - Processed questions, matching the structure of the input questions JSON.
 */
exports.analyzeQuestionsWithContext = async (questionsJson, contextData) => {
    const maxRetries = 3;
    let attempt = 0;

    // Assume contextData now includes roleName and roleDescription
    const payload = {
        questions: questionsJson,
        context: contextData // context now potentially includes roleName and roleDescription
    };

    const agentName = "analystAgent"; // Placeholder - adjust as needed
    const taskDescription = "Analyze questions with context";
    const agentEndpoint = '/analyst_agent_endpoint'; // Placeholder - adjust as needed

    async function callAgent() {
        attempt++;
        try {
            const response = await wingmanAgentsService.callWingmanAgentsApp(agentName, taskDescription, JSON.stringify(payload), agentEndpoint);

            if (response && response.data) {
                // Validate response structure against input
                if (isValidResponseStructure(questionsJson, response.data)) {
                    return response.data;
                } else {
                    logger.warn(`Attempt ${attempt}: Invalid response structure from the analyst agent.`);
                    if (attempt < maxRetries) {
                        return await callAgent(); // Retry
                    } else {
                        throw new Error(`After ${maxRetries} attempts, the analyst agent's response still does not match the expected format.`);
                    }
                }
            } else {
                throw new Error('Invalid or empty response from the analyst agent');
            }
        } catch (error) {
            logger.error(`Error on attempt ${attempt} analyzing questions with context: %o`, error);
            throw error;
        }
    }

    return await callAgent();
};


/**
 * Validates if the agent's response structure matches the expected input structure.
 * @param {Array} inputQuestions - Original array of questions.
 * @param {Array} agentResponse - Array of questions returned by the agent.
 * @returns {boolean} - True if structures match, false otherwise.
 */
function isValidResponseStructure(inputQuestions, agentResponse) {
    // Example validation, adjust based on actual requirements
    return agentResponse.every((item, index) => 
        'QuestionRecordId' in item &&
        'QuestionStatement' in item &&
        'QuestionDescription' in item &&
        Object.keys(item).length === Object.keys(inputQuestions[index]).length
    );
}



// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// this is just for testing purposes and will be deleted after finalizing this part

// Check if the file is run directly and not required by another module
if (require.main === module) {
    // Define dummy data for testing
    const questionsJson = [{"QuestionRecordId":"recQ8nlde7QmGSa5H","QuestionStatement":"Have you ever experienced uncertainty or confusion about which tool to use for a particular task?","QuestionDescription":""},{"QuestionRecordId":"recvXg669TI2GCbE5","QuestionStatement":"What tools and platforms are used for work management across the organization?","QuestionDescription":""},{"QuestionRecordId":"rect6fFkihxMNT7Id","QuestionStatement":"What tools and technologies are used by your software development team?","QuestionDescription":""},{"QuestionRecordId":"reccHLJQF1njfJaZ3","QuestionStatement":"Can you describe your company's technology infrastructure?","QuestionDescription":""},{"QuestionRecordId":"recFQRDgoUelmFWs1","QuestionStatement":"If yes, could you describe a situation where this happened?","QuestionDescription":""},{"QuestionRecordId":"recx0NFeRszbm86PD","QuestionStatement":"To what degree do you agree with the following statement: “I can perform similar tasks in different tools”","QuestionDescription":"1: Strongly disagree  5: Strongly agree"},{"QuestionRecordId":"recCPN2MYj6cJFrsv","QuestionStatement":"Can you give an example, where, in which tool(s)?","QuestionDescription":""},{"QuestionRecordId":"recKvFvjlnCi5SH77","QuestionStatement":"How do you manage the scalability of your technology?","QuestionDescription":""},{"QuestionRecordId":"recQ3ZYpa5cioPKsD","QuestionStatement":"Have you ever found a tool to be difficult to use or non-intuitive?","QuestionDescription":""},{"QuestionRecordId":"rec6OB1m8M0Pzk1VX","QuestionStatement":"If yes, which tool was it and what difficulties did you experience?","QuestionDescription":""},{"QuestionRecordId":"recrg3nRRQYXXtK2Q","QuestionStatement":"On a scale of 1-5, how well do you think the current toolset supports the overall productivity and effectiveness of your team?","QuestionDescription":"1: Poor support  5: Excellent support"},{"QuestionRecordId":"rec2caEDtDLVuOes2","QuestionStatement":"Could you describe a situation where a tool didn't fit well with your team's needs or way of work?","QuestionDescription":""},{"QuestionRecordId":"rec74eBqYbt36PWyv","QuestionStatement":"On a scale of 1-5, how well do the tools you use align with your team's needs and way of work?","QuestionDescription":"1: Poor alignment  5: Excellent alignment"},{"QuestionRecordId":"recmGg67j0wD98rne","QuestionStatement":"How flexible is your company in responding to changes?","QuestionDescription":"1 (Not at all flexible) - 5 (Extremely flexible)"},{"QuestionRecordId":"recjjhz9x1EQi1l9E","QuestionStatement":"Please indicate your level of agreement with the following statement: \"Our team focuses on delivering value to the customer above all else.\"","QuestionDescription":"1: Strongly disagree  5: Strongly agree"},{"QuestionRecordId":"rec654kVXf3RZNZHd","QuestionStatement":"Please indicate your level of agreement with the following statement: \"Our team is quick to adapt when a change in strategy or product direction occurs.\"","QuestionDescription":"1: Strongly disagree  5: Strongly agree"},{"QuestionRecordId":"rec8MqORfJUSRAtC5","QuestionStatement":"How mature is the adoption of Agile methodology within your company?","QuestionDescription":"1 (Not at all mature) - 5 (Extremely mature)"},{"QuestionRecordId":"recxbQIczuQ4bWvp1","QuestionStatement":"Can you describe the competencies and adaptability of employees within your company?","QuestionDescription":""},{"QuestionRecordId":"receHSgygIj3FD1y2","QuestionStatement":"How are you ensuring that your employees have the necessary skills for the digital age?","QuestionDescription":""}];
    const contextData = { reportDetails: 'Dummy report details', additionalInfo: 'Some additional context' };
    const roleName = 'Developer';

    // Log a message to indicate the start of the test
    console.log('Running analyzeQuestionsWithContext with dummy data for testing...');

    // Execute the test
    analyzeQuestionsWithContext(questionsJson, contextData, roleName)
        .then(response => console.log('Test call response:', JSON.stringify(response, null, 2)))
        .catch(error => console.error('Test call error:', error));
}