// /src/lib/airtableAgentsTasksUtils.js

require('dotenv').config();
const Airtable = require('airtable');
const logger = require('../../logger');


const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// fetch Squad data by SKU
exports.getSquadDataBySKU = async (squadSKU) => {
    try {
        const records = await base('WingmanAIsquads').select({
            filterByFormula: `{SquadSKU} = '${squadSKU}'`,
        }).firstPage();

        if (records.length > 0) {
            const squadRecord = records[0]; // Assuming SKU is unique

            // Basic squad data construction
            const response = {
                recordID: squadRecord.id,
                SKU: squadRecord.fields.SquadSKU,
                crewName: squadRecord.fields.SquadName,
                Description: squadRecord.fields.SquadDescription,
                SquadType: squadRecord.fields.SquadType,
                process: squadRecord.fields.SquadProcess,
                LLM: squadRecord.fields.SquadLLM,
                // Initialize Agents and Tasks as empty, will be populated based on SquadType
                agents: [],
                tasks: [],
            };

            // Handle different SquadType cases
            switch (squadRecord.fields.SquadType) {
                case 'HanSolo':
                    // Fetch and include only the first Agent's SKU and data for HanSolo type squads
                    if (squadRecord.fields.Agents && squadRecord.fields.Agents.length > 0) {
                        const agentSKU = squadRecord.fields['*AgentSKU (from Agents)'][0]; // For HanSolo this is an 1:1 relationship
                        // Now fetch the agent data by SKU
                        const agentData = await exports.getAgentDataBySKU(agentSKU);
                        //!!!>>>>>>>>>>>> here to decide what data from agents and/or tasks to add to the response
                        response.agents.push(agentData); // Add the fetched agent data to the response
                        //!!!>>>>>>>>>>>> here to decide what data from agents and/or tasks to add to the response
                    }
                    break;
                case 'JediCouncil':
                    // Placeholder for future development
                    // Logic for handling JediCouncil type squads
                    break;
                default:
                    // Optional: Handle unknown or undefined SquadType
                    logger.warn(`Unhandled SquadType for SquadSKU: ${squadSKU}`);
            }

            return response;
        } else {
            throw new Error('Squad not found');
        }
    } catch (error) {
        logger.error('Error fetching squad data:', error);
        throw error;
    }
};



// Utility function to fetch Agent data by SKU
exports.getAgentDataBySKU = async (agentSKU) => {
    try {
        const records = await base('WingmanAIagents').select({
            filterByFormula: `{AgentSKU} = '${agentSKU}'`,
        }).firstPage();

        if (records.length > 0) {
            const agentRecord = records[0]; // Assuming SKU is unique
            const assignedToolIds = agentRecord.fields.AssignedTools; // This should be an array of IDs

            // Fetch the tool names for the given IDs
            const toolNames = await getToolNamesByIds(assignedToolIds);

            // Construct the response in a specific order
            const response = {
                recordID: agentRecord.id,
                SKU: agentRecord.fields.AgentSKU,
                role: agentRecord.fields.AgentRole,
                goal: agentRecord.fields.AgentGoal,
                backstory: agentRecord.fields.AgentBackstory,
                tools: toolNames,
                llm: {model_name: agentRecord.fields.AgentLLMmodel, temperature: agentRecord.fields.AgentLLMtemperature},
                optionalParameters: agentRecord.fields.AgentOptionalParam,
                // Include other fields as needed here
            };

            return response;
        } else {
            throw new Error('Agent not found');
        }
    } catch (error) {
        logger.error('Error fetching agent data:', error);
        throw error;
    }
};



// Utility function to fetch Task data by SKU
exports.getTaskDataBySKU = async (taskSKU) => {
    try {
        const records = await base('WingmanAItasks').select({
            filterByFormula: `{TaskSKU} = '${taskSKU}'`,
        }).firstPage();

        if (records.length === 0) {
            throw new Error('Task not found');
        }

        const taskRecord = records[0]; // Assuming SKU is unique

        // Validate that AssignedToAgent is not empty
        if (!taskRecord.fields.AssignedToAgent || taskRecord.fields.AssignedToAgent.length === 0) {
            throw new Error(`The task with SKU '${taskSKU}' does not have an assigned agent. An assigned agent is required.`);
        }

        // Proceed with fetching the tool names for the given IDs if there are any assigned tools
        const assignedToolIds = taskRecord.fields.AssignedTools || [];
        let toolNames = [];
        if (assignedToolIds.length > 0) {
            toolNames = await getToolNamesByIds(assignedToolIds);
        }

        // Construct the response in a specific order
        const response = {
            recordID: taskRecord.id,
            SKU: taskRecord.fields.TaskSKU,
            Name: taskRecord.fields.TaskName,
            description: taskRecord.fields.TaskDescription,
            expected_output: taskRecord.fields.TaskExpectedOutput,
            agentRecordId: taskRecord.fields.AssignedToAgent[0], // this is an 1:1 relationship, so only one agent here --> pick first
            Agent: taskRecord.fields['*AgentName (from AssignedToAgent)'][0],
            tools: toolNames,
            optionalParameters: taskRecord.fields.TaskOptionalParam,
            // Include other specific fields here in the order you want them
        };

        return response;
    } catch (error) {
        logger.error('Error fetching task data:', error);
        throw error;
    }
};




const getToolNamesByIds = async (toolIds) => {
    try {
        const fetchPromises = toolIds.map((toolId) =>
            new Promise((resolve, reject) => {
                base('WingmanAItools').find(toolId, (err, record) => {
                    if (err) {
                        logger.error(`Error fetching tool name for ID: ${toolId}`, err);
                        reject(err);
                    } else {
                        //logger.debug(`Fetched tool name: ${record.fields.ToolName}`);
                        resolve(record.fields.ToolName);
                    }
                });
            })
        );
        const toolNames = await Promise.all(fetchPromises);
        return toolNames;
    } catch (error) {
        logger.error('Error fetching tool names:', error);
        throw error;
    }
};



// Direct test with actual Airtable data
(async () => {
    try {

        // Testing getAgentDataBySKU
        console.log('Testing getSquadDataBySKU with actual Airtable data...');
        const squadData = await exports.getSquadDataBySKU('investigation_areas');
        console.log('Squad Data:', JSON.stringify(squadData, null, 2));

        // Testing getAgentDataBySKU
        console.log('Testing getAgentDataBySKU with actual Airtable data...');
        const agentData = await exports.getAgentDataBySKU('researcher');
        console.log('Agent Data:', JSON.stringify(agentData, null, 2));

        // Testing getTaskDataBySKU
        console.log('Testing getTaskDataBySKU with actual Airtable data...');
        const taskData = await exports.getTaskDataBySKU('initial_research');
        console.log('Task Data:', JSON.stringify(taskData, null, 2));
    } catch (error) {
        console.error('Error during test:', error);
    }
})();