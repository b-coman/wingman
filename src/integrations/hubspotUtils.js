const axiosInstance = require('./hubspotConfig');

// Search for companies by name and domain
exports.searchCompanyByNameAndDomain = async (companyName, domainName) => {
    const url = '/crm/v3/objects/companies/search';

    const requestBody = {
        "filterGroups": [
            {
                "filters": [
                    { "propertyName": "name", "operator": "CONTAINS_TOKEN", "value": companyName }
                ]
            },
            {
                "filters": [
                    { "propertyName": "domain", "operator": "EQ", "value": domainName }
                ]
            }
        ],
        "properties": ["name", "domain", "website", "industry", "phone_number", "city"],
        "limit": 10,
        "after": 0
    };

    try {
        const response = await axiosInstance.post(url, requestBody);
        return response.data.results.length > 0 ? response.data.results : null;
    } catch (error) {
        console.error('Error searching for company:', error.response ? `${error.response.status}: ${error.response.statusText}` : error.message);
        throw error;
    }
}

// Fetch notes for a specific company
exports.fetchNotesForCompany = async (companyId) => {
    const url = `/engagements/v1/engagements/associated/COMPANY/${companyId}/paged`;

    const params = {
        limit: 100,
        offset: 0
    };

    try {
        const response = await axiosInstance.get(url, { params });
        const notes = response.data.results.filter(engagement => engagement.engagement.type === 'NOTE');
        return notes;
    } catch (error) {
        console.error('Error fetching notes for company:', error.response ? `${error.response.status}: ${error.response.statusText}` : error.message);
        throw error;
    }
}
