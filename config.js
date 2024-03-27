//config.js

const express = require('express');
const app = express();
const isDevelopment = process.env.NODE_ENV === 'development';

const systemRules ={
    rule1: `The first most important context is the one provided in the context of a company, if it's any.
    The second most important context is the one provided in the context of the engagement, if it's any.
    The third most important context is the one provided in the context of the campaign: the source of the lead, the article the client read.`,
};

const agents = {
    // marketing agent --> used in New Engagement Flow
    agentsBaseURL: isDevelopment ? 'http://127.0.0.1:5000' : 'https://wingman-agents.azurewebsites.net',
    
    marketingAgentEndpoint: '/mkt_crew',
    marketingTaskDescription: "Analyze market for a given company",
    marketingTaskPrompt: `You are helping the Modus Create sales team to qualify a prospective lead. The lead's company name is $(COMPANY) and their website is https://{{{DOMAIN}}} .
    Someone from their side filled in a form in one of Modus Create blog articles, expressing their interest in our services.
    {{{SOURCE_DETAILS}}}. 
    Your task is to conduct an Internet research regarding this company, their general threads especially in the context of the article mentioned above. 
    As you are a market expert, the key point is to have a deep look on any signals present online, news, market data, social posts, or any other sources that might reveal areas that Modus can investigate further with their representatives. 
    The end goal is to find that point that resonates most with their business context. Please include references everywhere is possible.
    After the research, please conclude with a list of 3 main areas Modus might pursue to win this client.
    Each area should include a statement (short), a description (longer form), and a confidence score between 0 and 1, where 1 indicates very high confidence.
    The confidence score should reflect the likelihood of the statement being true.
    Format your response as a JSON array of objects. Each object should follow this structure: {"statement": "Your statement here", "description": "description here", "confidenceScore": 0.95}.
    Do not include any formatting elements or line breaks within the objects. Ensure to use proper JSON formatting with double quotes for keys and string values.
    You will get here some additional context, that might help you to better shape your response:
    Company Context: {{{COMPANY_CONTEXT}}}
    Engagement Context: {{{ENGAGEMENT_CONTEXT}}}
    Campaign Context: {{{CAMPAIGN_CONTEXT}}}
    Also, when evaluating those contexts you should be aware by some prioritization rules.
    The prioritization rules are: {{{SYSTEM_RULES}}}`,

    // general assess agent --> used in General Assessment Flow
    generalAssessAgentEndpoint: '/general_assess',
    generalAssessDescription: "Search information on internet",
    generalAssessTaskPrompt: `Complete an Internet research about a company named $(COMPANY), https://$(DOMAIN). 
    The output will be structured as a numbered list, each item being backed by data, or citacions.  
    References to company's major initiatives, leadership team pubic position or any other recent information should made in the context.
    The key area that should be investigated is revelead by the following statement: 
    $(APPROVED_PROMPT).`,

    // identify pains agent
    generalPainsIdentifierEndpoint: '/identify_pains',
    generalPainsIdentifierDescription: "Analyze data and provide a list of pains",
    generalPainsIdentifierTaskPrompt: `You will get two datasets: an initial research about a company named $(COMPANY) and a set of pains structured as JSON.
     You will get thsese inputs at the end of this prompt.
     Your task is to look on the initial research and the pains list and extract a list of pains that are very likely to be felt by the company, together with a reasoning why you consider this pain point should be included, considering the company's context revelead by the initial research.
     You will return the list of selected pains as a JSON array of objects. 
     Each object should follow this structure: {"recordID": "recordID here, according to the list provided", "painSKU": "the pain identifier here, according to the list provided", "reasoning": "the reason why was chosen", "confidenceScore": ""}.
     Confidence score should have a value from 0 to 1, where 1 indicates very high confidence.
     You will provide only the pains you are very confident on, with a score bigger than 0.7.
     Here are the inputs for you analysis: 
     // Initial research starts here 
     {{{INITIAL_RESEARCH}}}
     // Initial research ends here 
     // Pains list starts here 
     {{{PAINS_LIST}}}
     // Pains list ends here`,

    // generate initial report
    generalReportAgentEndpoint: '/create_report',
    generalReportDescription: "Create a comprehensive report based on an initial input data",
    generalReportTaskPrompt: `You work for a consultancy firm named Modus Create. Modus Create is a technological and management consultancy firm that helps companies to transform their businesses for the new era. Our mantra at Modus is "butique style, enterprise scale".
    An initial research about a potential new client, {{{COMPANY}}}, was conducted by one of our coleagues. 
    I will provide it at the end of this prompt, together with a list of possible pains. This list of pains is formated as JSON, and has the following fields:
    - painSKU - it is an internal identifier, you can ignore it in your analysis
    - painStatement - a short statement about the pain
    - painDescription - a longer description about the pain, highlighting what the subject feels when the pain is present
    - painImpact - possible business impact when pain arises
    Based on this initial data (research and list of pains) you have to create a profesional business report. General rules you should consider when you formulate your response:
    - start with an introductory part, explaining the general market/industry context;
    - next sections will include the following topics: particular challanges that {{{COMPANY}}} is facing, what they feel when a certain challange is present or a pain arises, solutions that might be considered to address the challanges, and how the solutions might impact the business;
    - at the end include a section about how Modus Create can help the company to address the challanges and the pains - be positive and forward thinking here;
    - create a flow for the report that is easy to follow and easy to read; I will penalize you if you use bullet points in more than one paragraph;
    - when appropriate, or when it makes sense to sustain your point of view (especially negative facts), please insert examples and data extracted from the initial reserach - this is super important, don't make negative claims that are not explained, and sustained by data and facts;
    - you have to formulate the whole report at the second person, in a professional business language - don't use 'they' too often; instead of 'they', use 'your organization' or the name of the company;
    - you should abstain yourself from making decisive claims; formulate the statements in a potential grammatical mood - please favor an indecisive language, using constructs like 'might be', 'seems', 'very likely';
    - do not include in the report direct quotes from pain points (or mentioning them directly, leaving the impression you had this data on hand) - instead of that provide a reasoning and your own interpretation;
    - the report should be formated as markdown, being ready to transformed in a pdf document.
    
    This being said, I wish you a great success and please see here the initial research and pain points I mentioned above: 

    // Initial research starts here 
    {{{INITIAL_RESEARCH}}}
    // Initial research ends here 

    // potential pain points list starts here 
    {{{PAINS}}}
    // potential pain points list ends here`,

};

const emails = {
    // clent emails
    welcomeEmailSubject: 'Welcome to a new journey',
    welcomeEmailContent: `We're glad you found our article on the Modus Create blog engaging. As a welcome gesture, we're preparing a personalized market analysis for you. This complimentary analysis will dive into the opportunities and challenges within your sector, providing you with targeted insights.
    <br><br>
    Expect this detailed overview in your inbox soon. It's crafted to support your strategic decisions with actionable data. Should you have any inquiries or wish for an in-depth discussion, don't hesitate to contact us.
    <br><br>
    Welcome aboard,`,

    genReportEmailSubject: 'Preliminary assessment report for {{{COMPANY_NAME}}}',
    genReportEmailContent: `I hope this message finds you well.
    <br><br>
    We are pleased to inform you that your preliminary assessment is now complete. 
    Attached, you will find a detailed report of our findings and recommendations tailored specifically to your organization's needs and objectives.
    You also can access it at the following link: <a href={{{REPORT_URL}}}>{{{REPORT_FILENAME}}}</a>.
    <br><br>
    We believe this report will provide valuable insights into the areas of improvement and potential growth opportunities for your business. 
    Our team is committed to supporting you in navigating the next steps and is ready to discuss any aspects of the report in further detail.
    <br><br>
    Please do not hesitate to contact us should you have any questions or require further clarification on the report findings. 
    We look forward to the opportunity of discussing the next steps with you.`,
    
    // admin emails
    adminNewEngagementSubject: 'YAY, new lead landed',
    adminNewEngagementContent: `Good news: a new lead came in. Here are the the details:
    <br><br>
    Company: <a href={{{COMPANY_DOMAIN}}}>{{{COMPANY_NAME}}}</a> 
    <br>Contact: {{{CONTACT_NAME}}}
    <br>Source: {{{SOURCE_NAME}}}
    <br><br>As you are the Growth representative for this source, please take a look at the new lead, and review at your earliest convenience.
    <br>
    Your approval is required to advance to the next steps.`,

    adminStrategicDirectionsSubject: 'Strategic directions for {{{COMPANY_NAME}}}',
    adminStrategicDirectionsContent: `Strategic directions were identified for {{{COMPANY_NAME}}} under engagement {{{ENGAGEMENT_ID}}}.
    <br><br>Please review at your earliest convenience. Your approval is required to advance to the next steps.`,

    adminRawReportGeneratedSubject: 'Raw Report ready for {{{COMPANY_NAME}}}',
    adminRawReportGeneratedContent: `A raw report for {{{COMPANY_NAME}}} under engagement {{{ENGAGEMENT_ID}}} / assessment {{{ASSESSMENT_ID}}} has been completed. 
    <br><br>Please review at your earliest convenience: [Link to Report]. Your approval is required to advance to the next steps.`
};

const htmlTemplates = {
    // template for pdf report
    pdfReport: `
    <html>
<head>
    <title>PDF</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
    body {
        font-family: 'Arial', sans-serif;
        font-size: 1.1em; /* Adjust base font size if needed */
        line-height: 1.6;
        color: #4A4A4A;
        background-color: #fff;
        width: 80%; /* This will make the content width 80% of the page */
        margin: 0 auto;
        padding: 2.5em;
    }
    h1 {
        font-size: 2em; /* Equivalent to 26px */
        font-weight: normal;
        color: #000;
        padding-bottom: 0.25em; /* Equivalent to 4px */
        margin-bottom: 1.25em; /* Equivalent to 20px */
        border-bottom: 3px solid #4CAF50;
    }
    h2 {
        font-size: 1.5em; /* Equivalent to 22px */
        font-weight: bold;
        color: #000;
        margin-top: 2.5em; /* Equivalent to 40px */
        margin-bottom: 0.625em; /* Equivalent to 10px */
    }
    h3 {
        font-size: 1.2em; /* Equivalent to 18px */
        font-weight: bold;
        margin-top: 1.25em; /* Equivalent to 20px */
        margin-bottom: 0.5em; /* Equivalent to 8px */
    }
    p, ul, li {
        font-size: 1em; /* Equivalent to 14px */
        margin-top: 0.625em; /* Equivalent to 10px */
    }
    a {
        color: #1a0dab;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    ul {
        list-style-type: none;
        padding-left: 0;
    }
    li {
        margin-bottom: 0.3125em; /* Equivalent to 5px */
    }
    li:before {
        content: "• ";
        color: #4CAF50; /* Bullet color */
        font-weight: bold; /* If you want it to be bold */
    }
    .footer {
        text-align: center;
        margin-top: 2.5em; /* Equivalent to 40px */
        padding-top: 1.25em; /* Equivalent to 20px */
        border-top: 1px solid #EAEAEA;
        color: #777;
    }
    @media print {
        body {
            width: 100%; /* Use full width when printing */
        }
        /* Adjust font-sizes and widths for printing if necessary */
    }
</style>
</head>
<body>
    {{{REPORT}}}
</body>
</html>

     ` 
}

module.exports = { agents, emails, htmlTemplates }; 