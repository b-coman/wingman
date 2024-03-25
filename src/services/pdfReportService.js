const fs = require('fs');
const path = require('path');
const marked = require('marked');
const puppeteer = require('puppeteer');
const logger = require('../../logger'); 
const airtableUtils = require('../lib/airtableUtils');

// Convert Markdown to HTML using 'marked'
function convertMarkdownToHTML(markdownContent) {
    return marked(markdownContent);
}

// Generate and save a PDF from HTML content
async function generateAndSavePDF(htmlContent, pdfFileName) {
    try {
        const pdfFilePath = path.join(__dirname, '..', 'public', 'pdf', pdfFileName);
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        await page.pdf({ path: pdfFilePath, format: 'A4' });
        await browser.close();
        return pdfFilePath;
    } catch (error) {
        logger.error(`Failed to generate or save PDF: ${error}`);
        throw new Error(`Failed to generate or save PDF: ${error.message}`);
    }
}

// Main service function to process agent output, generate a PDF, and update Airtable
async function processAgentOutput(markdownContent, assessmentDetailId, companyShortName, assessmentSku) {
    try {
        const htmlContent = convertMarkdownToHTML(markdownContent);
        const pdfFileName = `${companyShortName}-${assessmentSku}-${assessmentDetailId}.pdf`;
        const pdfFilePath = await generateAndSavePDF(htmlContent, pdfFileName);

        // Check if an entry exists and update or create accordingly
        const existingEntry = await airtableUtils.getFinalReportEntry(assessmentDetailId);
        if (existingEntry) {
            await airtableUtils.updateFinalReportEntry(assessmentDetailId, markdownContent, htmlContent, pdfFileName);
        } else {
            await airtableUtils.createFinalReportEntry(assessmentDetailId, markdownContent, htmlContent, pdfFileName);
        }

        logger.info(`PDF generated and saved at: ${pdfFilePath}`);
        // Optionally return the path or any other data you might need
        return pdfFilePath;
    } catch (error) {
        logger.error(`Error in processAgentOutput: ${error}`);
        // Depending on your error handling strategy, you might want to rethrow the error, return null, or handle it differently
        throw error; // or handle differently
    }
}
module.exports = { processAgentOutput };

// Example usage
// Replace placeholders with actual values
// processAgentOutput('Your Markdown Content Here', 'assessmentDetailId', 'CompanyShortName', 'AssessmentSKU');
