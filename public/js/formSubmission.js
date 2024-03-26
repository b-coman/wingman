document.addEventListener("DOMContentLoaded", function () {
    const sectionTimes = {};
    let totalTimeSpent = {};

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.id;
            if (entry.isIntersecting) {
                sectionTimes[id] = sectionTimes[id] || { totalVisibleTime: 0, startTime: Date.now() };
            } else if (sectionTimes[id]) {
                sectionTimes[id].totalVisibleTime += Date.now() - sectionTimes[id].startTime;
                totalTimeSpent[id] = sectionTimes[id].totalVisibleTime;
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.trackable-section').forEach(section => {
        observer.observe(section);
    });

    function getMostViewedSection() {
        const sortedSections = Object.keys(totalTimeSpent).sort((a, b) => totalTimeSpent[b] - totalTimeSpent[a]);
        const mostViewedSectionId = sortedSections[0];
        return {
            id: mostViewedSectionId,
            content: document.getElementById(mostViewedSectionId)?.textContent || ''
        };
    }

    document.getElementById('submissionForm').addEventListener('submit', function (event) {
        event.preventDefault();
        const mostViewedSection = getMostViewedSection();

        const formData = {
            name: document.getElementById('name').value,
            company: document.getElementById('company').value,
            role: document.getElementById('role').value,
            workEmail: document.getElementById('workEmail').value,
            sourceId: document.getElementById('sourceId').value,
            engagementInitialContext: mostViewedSection.content
            // Add any additional fields as needed
            //mostViewedSectionId: mostViewedSection.id,
            //mostViewedSectionContent: mostViewedSection.content
        };

        console.log('Form Data:', formData);

        // Assuming you're sending the data to a server endpoint.
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
                document.getElementById('submissionForm').reset(); // Clear the form fields after submission
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    });
});
