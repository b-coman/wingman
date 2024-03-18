//config.js

const express = require('express');
const app = express();
const isDevelopment = process.env.NODE_ENV === 'development';

const agents = {
    agentsBaseURL: isDevelopment ? 'http://127.0.0.1:5000' : 'https://wingman-agents.azurewebsites.net',
    marketingAgentEndpoint: '/mkt_crew',
    researcherAgentEndpoint: '/research_crew',
    marketingTaskDescription: "Analyze market for a given company",
    marketingTaskPrompt: `You are helping the Modus Create sales team to qualify a prospective lead. The lead's company name is $(COMPANY) and their website is https://$(DOMAIN) .
Someone from their side filled in a form in one of Modus Create blog articles, expressing their interest in our services.
The title of the article is "Digital transformation is not possible without cybersecurity".
The link to the article is $(SOURCE_DETAILS). 
Your task is to make an Internet research regarding the lead, their general threads especially in the context of the article mentioned above. As you are a market expert, a key point is to have a deep look on any signals present online, news, market data, social posts, or other sources that might reveal areas that Modus can investigate further with their representatives. The end goal is to find that point that resonates most with their business context. Please include references when is possible.
After the research, please conclude with a list of 3 main areas Modus might pursue to win this client.
Each area should include a statement (short), a description (longer form), and a confidence score between 0 and 1, where 1 indicates very high confidence.
The confidence score should reflect the likelihood of the statement being true
Format your response as a JSON array of objects. Each object should follow this structure: {"statement": "Your statement here", "description": "description here", "confidenceScore": 0.95}.
Do not include any formatting elements or line breaks within the objects. Ensure to use proper JSON formatting with double quotes for keys and string values.`,
};

module.exports = agents; 