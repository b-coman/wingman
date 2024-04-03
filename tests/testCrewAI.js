const axios = require('axios');

async function generateAndSendCrewConfig() {
    const crewConfig = {
        crewName: "ResearchCrew",
        agents: [
            {
                role: 'Web Researcher',
                goal: 'Find information on the internet',
                backstory: "You are a researcher capable of finding information...",
                llm: {
                    model_name: 'gpt-3.5-turbo',
                    temperature: 0.1
                },
                tools: ['SearchTool', 'AnalysisTool'],
                max_iter: 15,
                verbose: true,
                allow_delegation: false,
                memory: true
            }
        ],
        tasks: [
            {
                description: "Research internet for topic X and summarize findings",
                parameters: {
                    topic: "Machine Learning",
                    depth: "comprehensive"
                }
            }
        ]
    };

    let data = JSON.stringify(crewConfig);
    let urlEndpoint = 'http://localhost:5000/test'; // Update with your Flask app's URL and route
    let configAxios = {
        method: 'post',
        maxBodyLength: Infinity,
        url: urlEndpoint,
        headers: { 
            'Content-Type': 'application/json'
        },
        data: data,
        timeout: 600000 // Adjust timeout as needed
    };

    try {
        const response = await axios.request(configAxios);
        console.log('Response from Flask app:', response.data);
    } catch (error) {
        console.error('Error sending configuration to Flask app:', error);
    }
}

// Execute the test function
generateAndSendCrewConfig();
