// /public/js/formSubmission.js

document.getElementById('submissionForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    // Construct formData from the form inputs
    const formData = {
        name: document.getElementById('name').value,
        company: document.getElementById('company').value,
        role: document.getElementById('role').value,
        workEmail: document.getElementById('workEmail').value,
        sourceId: 'SRC-001',
        engagementInitialContext: '{}'
    };

    // Use fetch to submit formData as JSON
    fetch('/api/submit-form', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        // Handle success response (e.g., show a success message)
    })
    .catch((error) => {
        console.error('Error:', error);
        // Handle error response (e.g., show an error message)
    });
});
