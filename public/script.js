document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to dynamically injected "Add Company" and "Add Contact" buttons
    document.getElementById('dataContainer').addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('add-company')) {
            showAddModal('company');
        } else if (target.classList.contains('add-contact')) {
            showAddModal('contact');
        }
    });
});

// Function to show the modal for adding a company or contact
function showAddModal(entityType) {
    // Reset the universal form within the modal before setting up
    const form = document.getElementById('modalBody');
    form.innerHTML = ''; // Clear existing form content

    // Dynamically set the modal's title and form fields based on entityType
    if (entityType === 'company') {
        document.getElementById('genericModalTitle').textContent = 'Add Company';
        // Append company-specific form fields to the modalBody
        form.appendChild(generateTextInput('companyName', 'Company Name'));
        form.appendChild(generateTextInput('industry', 'Industry'));
        form.appendChild(generateTextInput('size', 'Size', 'number'));
    } else if (entityType === 'contact') {
        document.getElementById('genericModalTitle').textContent = 'Add Contact';
        // Append contact-specific form fields to the modalBody
        form.appendChild(generateTextInput('firstName', 'First Name'));
        form.appendChild(generateTextInput('lastName', 'Last Name'));
        form.appendChild(generateTextInput('email', 'Email', 'email'));
        // Add more fields as needed
    }

    // Show the modal after setting up
    $('#genericModal').modal('show');
}

// Function to create and return a text input element
function generateTextInput(id, label, type = 'text') {
    const div = document.createElement('div');
    div.className = 'form-group';

    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', id);
    labelElement.textContent = label;
    div.appendChild(labelElement);

    const input = document.createElement('input');
    input.type = type;
    input.className = 'form-control';
    input.id = id;
    input.required = true;
    div.appendChild(input);

    return div;
}




function loadCompanies() {
    fetch('http://localhost:3000/api/companies')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Network response was not ok.');
            }
        })
        .then(companies => {
            document.getElementById('sectionTitle').textContent = 'Companies';
            document.getElementById('addButtonContainer').innerHTML = `<button type="button" class="btn btn-primary" onclick="showAddCompanyModal()">+ Add Company</button>`;
            const table = generateCompaniesTable(companies);
            document.getElementById('dataContainer').innerHTML = table;
        })
        .catch(error => console.error('Error:', error));
}

function loadContacts() {
    fetch('http://localhost:3000/api/contacts')
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Network response was not ok.');
            }
        })
        .then(contacts => {
            document.getElementById('sectionTitle').textContent = 'Contacts';
            document.getElementById('addButtonContainer').innerHTML = `<button type="button" class="btn btn-primary" onclick="showAddContactModal()">+ Add Contact</button>`;
            const table = generateContactsTable(contacts);
            document.getElementById('dataContainer').innerHTML = table;
        })
        .catch(error => console.error('Error:', error));
}

function generateCompaniesTable(companies) {
    let table = `
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">Company Name</th>
                    <th scope="col">Industry</th>
                    <th scope="col">Size</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>`;
    
    companies.forEach(company => {
        table += `
            <tr>
                <th scope="row">${company.CompanyID}</th>
                <td>${company.CompanyName}</td>
                <td>${company.Industry}</td>
                <td>${company.Size}</td>
                <td>
                    <button onclick="showEditCompanyModal(${company.CompanyID})" class="btn btn-primary">Edit</button>
                    <button onclick="deleteCompany(${company.CompanyID})" class="btn btn-danger">Delete</button>
                </td>
            </tr>`;
    });

    table += `</tbody></table>`;
    return table;
}

function generateContactsTable(contacts) {
    let table = `
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">First Name</th>
                    <th scope="col">Last Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Company ID</th>
                    <th scope="col">Role ID</th>
                    <th scope="col">PoC</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>`;
    
    contacts.forEach(contact => {
        table += `
            <tr>
                <th scope="row">${contact.ContactID}</th>
                <td>${contact.FirstName}</td>
                <td>${contact.LastName}</td>
                <td>${contact.Email}</td>
                <td>${contact.CompanyID}</td>
                <td>${contact.RoleID}</td>
                <td>${contact.PoC}</td>
                <td>
                    <button onclick="showEditContactModal(${contact.ContactID})" class="btn btn-primary">Edit</button>
                    <button onclick="deleteContact(${contact.ContactID})" class="btn btn-danger">Delete</button>
                </td>
            </tr>`;
    });

    table += `</tbody></table>`;
    return table;
}

function showAddCompanyModal() {
    // Show modal for adding a new company
}

function showAddContactModal() {
    // Show modal for adding a new contact
}

function showEditCompanyModal(companyId) {
    // Show modal for editing a company
}

function showEditContactModal(contactId) {
    // Show modal for editing a contact
}

function deleteCompany(companyId) {
    // Delete company with specified ID
}

function deleteContact(contactId) {
    // Delete contact with specified ID
}

// Other functions for handling form submissions, editing, and additional interactions



/*

document.addEventListener('DOMContentLoaded', function() {
    loadCompanies();
    loadContacts(); 
});


// fetch('https://wingman-app.azurewebsites.net/api/companies')


function showAddCompanyModal() {
    document.getElementById('companyForm').reset();
    document.getElementById('companyId').value = '';
    document.getElementById('modalTitle').textContent = 'Add Company';
    $('#companyModal').modal('show'); // Using jQuery to show the Bootstrap modal
}

// Attach an event listener to the company form for when it's submitted
document.getElementById('companyForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Gather form data
    const companyId = document.getElementById('companyId').value;
    const companyName = document.getElementById('companyName').value;
    const industry = document.getElementById('industry').value;
    const size = document.getElementById('size').value;

    const method = companyId ? 'PUT' : 'POST'; // If a company ID is present, we're updating, otherwise adding
    const url = companyId ? 
  //      `https://wingman-app.azurewebsites.net/api/companies/${companyId}` : 
  //      'https://wingman-app.azurewebsites.net/api/companies';

        `http://localhost:3000/api/companies/${companyId}` : 
        'http://localhost:3000/api/companies';

    // Setup our fetch request
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            CompanyName: companyName,
            Industry: industry,
            Size: size
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data);
        // Reload the companies
        loadCompanies();
        // Hide the modal
        $('#companyModal').modal('hide');
    })
    .catch(error => console.error('Error:', error));
});


function showEditCompanyModal(companyId) {
    // Fetch the company's data
    fetch(`http://localhost:3000/api/companies/${companyId}`)
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Network response was not ok.');
        }
    })
    .then(company => {
        // Assume 'company' is the object with the company data
        document.getElementById('companyName').value = company.CompanyName;
        document.getElementById('industry').value = company.Industry;
        document.getElementById('size').value = company.Size;
        document.getElementById('companyId').value = company.CompanyID;  // Used to know if we're editing

        document.getElementById('modalTitle').textContent = 'Edit Company';

        // Show the modal
        $('#companyModal').modal('show');
    })
    .catch(error => console.error('Error:', error));
}


function deleteCompany(companyId) {
    if (!confirm('Are you sure you want to delete this company?')) return;

    fetch(`http://localhost:3000/api/companies/${companyId}`, {
        method: 'DELETE',
    })
    .then(response => {
        if (response.ok) {
            loadCompanies();  // Reload the list after deletion
        } else {
            throw new Error('Deletion failed.');
        }
    })
    .catch(error => console.error('Error:', error));
}


// Load Contacts
function loadContacts() {
    fetch('http://localhost:3000/api/contacts')
    .then(response => response.json())
    .then(contacts => {
        document.getElementById('sectionTitle').textContent = 'Contacts'; // Dynamic title
        document.getElementById('addButtonContainer').innerHTML = `<button type="button" class="btn btn-primary" onclick="showAddContactModal()">+ Add Contact</button>`;
        const table = generateContactsTable(contacts);
        document.getElementById('dataContainer').innerHTML = table; // Use the same container
    })
    .catch(error => console.error('Error loading contacts:', error));
}

// Generate Contacts Table HTML
function generateContactsTable(contacts) {
    let table = `
        <table class="table">
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">First Name</th>
                    <th scope="col">Last Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Company ID</th>
                    <th scope="col">Role ID</th>
                    <th scope="col">PoC</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>`;
    
    contacts.forEach(contact => {
        table += `
            <tr>
                <th scope="row">${contact.ContactID}</th>
                <td>${contact.FirstName}</td>
                <td>${contact.LastName}</td>
                <td>${contact.Email}</td>
                <td>${contact.CompanyID}</td>
                <td>${contact.RoleID}</td>
                <td>${contact.PoC}</td>
                <td>
                    <button onclick="showEditContactModal(${contact.ContactID})" class="btn btn-primary">Edit</button>
                    <button onclick="deleteContact(${contact.ContactID})" class="btn btn-danger">Delete</button>
                </td>
            </tr>`;
    });

    table += `</tbody></table>`;
    return table;
}


function showAddContactModal() {
    document.getElementById('contactForm').reset();
    document.getElementById('contactId').value = ''; // Assuming you have a hidden input for contactId in your form
    document.getElementById('contactModalTitle').textContent = 'Add Contact';
    $('#contactModal').modal('show'); // Show the contact modal
}

// Handle deleting a contact
function deleteContact(contactId) {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    fetch(`http://localhost:3000/api/contacts/${contactId}`, {
        method: 'DELETE',
    })
    .then(response => {
        if (response.ok) {
            loadContacts(); // Reload contacts list
        } else {
            throw new Error('Deletion failed');
        }
    })
    .catch(error => console.error('Error deleting contact:', error));
}



document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('addButton').addEventListener('click', showAddModal); // Example button ID for showing the modal
});

function showAddModal(entityType) {
    // Reset the form within the modal
    const form = document.getElementById('universalForm');
    form.reset();

    // Change the modal content based on entityType
    if (entityType === 'company') {
        // Set up the form for adding/editing a company
        document.getElementById('modalTitle').textContent = 'Add Company';
        // Include company-specific form fields
    } else if (entityType === 'contact') {
        // Set up the form for adding/editing a contact
        document.getElementById('modalTitle').textContent = 'Add Contact';
        // Include contact-specific form fields
    }

    // Show the modal
    $('#universalModal').modal('show');
}

// Example button triggers for the modal
document.getElementById('addCompanyBtn').onclick = function() { showAddModal('company'); };
document.getElementById('addContactBtn').onclick = function() { showAddModal('contact'); };

// Handle form submission
document.getElementById('universalForm').addEventListener('submit', function(event) {
    event.preventDefault();
    // Determine whether we're dealing with a company or contact based on modal title or a hidden input
    // Perform the appropriate fetch request based on the form data and entity type
    // After successful operation, hide the modal and refresh the data view
});



/////////////////////////////

document.getElementById('companyForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting in the traditional way

    const companyId = document.getElementById('companyId').value; // For updates, this should be set
    const companyName = document.getElementById('companyName').value;
    const industry = document.getElementById('industry').value;
    const size = document.getElementById('size').value;

    const method = companyId ? 'PUT' : 'POST';
    const url = companyId ?
        `http://localhost:3000/api/companies/${companyId}` : 
        'http://localhost:3000/api/companies';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ CompanyName: companyName, Industry: industry, Size: size })
    })
    .then(response => response.json())
    .then(() => {
        $('#companyModal').modal('hide'); // Close the modal
        loadCompanies(); // Refresh the companies list
    })
    .catch(error => console.error('Error:', error));
});

// Similar event listener and fetch request handling for contactForm

*/