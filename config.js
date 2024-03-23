//config.js

const express = require('express');
const app = express();
const isDevelopment = process.env.NODE_ENV === 'development';

const agents = {
    // marketing agent --> used in New Engagement Flow
    agentsBaseURL: isDevelopment ? 'http://127.0.0.1:5000' : 'https://wingman-agents.azurewebsites.net',
    marketingAgentEndpoint: '/mkt_crew',
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
    
    // general assess agent --> used in General Assessment Flow
    generalAssessAgentEndpoint: '/general_assess',
    generalAssessDescription: "Search information on internet",
    generalAssessTaskPrompt: `Complete an Internet research about a company named $(COMPANY), https://$(DOMAIN). 
    The output will be structured as a numbered list, each item being backed by data, or citacions.  
    References to company's major initiatives, leadership team pubic position or any other recent information should made in the context.
    The key area that should be investigated is revelead by the following statement: 
    $(APPROVED_PROMPT).`,

    // generate initial report
    generalReportAgentEndpoint: '/create_report',
    generalReportDescription: "Create a comprehensive report based on an initial reserach",
    generalReportTaskPrompt: `An initial research about a company named $(COMPANY) was conducted by one of our coleagues. I will provide it at the end of this prompt.
    Based on this initial research you have to create a profesional business report to be sent and presented to our contact to thei company. 
    So you need to use a way to address that acomplish this situation. 
    The idea is something like "we, Modus Create, we created this, and we present the findings to you, $(COMPANY)" - Modus Create is the company you work for.
    The report should be well structured, according to the best practices you are aware of.
    You'll start with an introductory part, presenting the context. 
    Feel free to order the following sections as you wish, but an important aspect is to include at the end a section about how Modus Create can help $(COMPANY) on next step, and improving their capabilities
    This being said, I wish you a great success and please see here the initial research I mentioned above: 
    $(INITIAL_RESEARCH).`,

};

const emails = {
    // clent emails
    welcomeEmailSubject: 'Welcome to a new journey',
    welcomeEmailContent: `We're glad you found our article on the Modus Create blog engaging. As a welcome gesture, we're preparing a personalized market analysis for you. This complimentary analysis will dive into the opportunities and challenges within your sector, providing you with targeted insights.
    <br><br>
    Expect this detailed overview in your inbox soon. It's crafted to support your strategic decisions with actionable data. Should you have any inquiries or wish for an in-depth discussion, don't hesitate to contact us.
    <br><br>
    Welcome aboard,`,

    genReportEmailSubject: 'Welcome to a new journey',
    genReportEmailContent: `TRALALA SI LALA --> We're glad you found our article on the Modus Create blog engaging. As a welcome gesture, we're preparing a personalized market analysis for you. This complimentary analysis will dive into the opportunities and challenges within your sector, providing you with targeted insights.
    <br><br>
    Expect this detailed overview in your inbox soon. It's crafted to support your strategic decisions with actionable data. Should you have any inquiries or wish for an in-depth discussion, don't hesitate to contact us.
    <br><br>
    Welcome aboard,`,

    // admin emails
    adminRawReportGeneratedSubject: 'Raw Report ready for {{{COMPANY_NAME}}}',
    adminRawReportGeneratedContent: `A raw report for {{{COMPANY_NAME}}} under engagement {{{ENGAGEMENT_ID}}} / assessment {{{ASSESSMENT_ID}}} has been completed. 
    <br><br>Please review at your earliest convenience: [Link to Report]. Your approval is required to advance to the next steps.`
}

module.exports = {agents, emails}; 