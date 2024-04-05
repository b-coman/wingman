// /src/lib/airtableAgentsTasksUtils.js

require('dotenv').config();
const airtableUtils = require('./airtableUtils');
const Airtable = require('airtable');
const logger = require('../../logger');


const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

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
          id: agentRecord.id,
          SKU: agentRecord.fields.AgentSKU,
          Name: agentRecord.fields.AgentName,
          Goal: agentRecord.fields.AgentGoal,
          Backstory: agentRecord.fields.AgentBackstory,
          Tools: toolNames,
          LLMmodel: agentRecord.fields.AgentLLMmodel,
          LLMtemperature: agentRecord.fields.AgentLLMtemperature,
          OptionalParameters: agentRecord.fields.AgentOptionalParam,
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
            id: taskRecord.id,
            SKU: taskRecord.fields.TaskSKU,
            Name: taskRecord.fields.TaskName,
            Description: taskRecord.fields.TaskDescription,
            agentRecordId: taskRecord.fields.AssignedToAgent[0],
            Agent: taskRecord.fields['*AgentName (from AssignedToAgent)'][0], 
            ExpectedOutput: taskRecord.fields.TaskExpectedOutput,
            Tools: toolNames, 
            OptionalParameters: taskRecord.fields.TaskOptionalParam,
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