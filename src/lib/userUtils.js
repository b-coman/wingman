// /src/lib/userUtils.js

// Utility function to extract domain from email
exports.extractDomainFromEmail = (email) => {
    return email.substring(email.lastIndexOf("@") + 1);
};

// Utility function to split a full name into first and last names
exports.splitFullName = (fullName) => {
    const [firstName, ...lastName] = fullName.split(' ');
    return { firstName, lastName: lastName.join(' ') };
};
