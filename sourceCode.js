const fs = require('fs');
const path = require('path');

const skipDirectories = ['node_modules', '.github', 'crewai_app', 'tests']; // Directories to skip
const skipFiles = ['combined.log', 'error.log', 'README.md', 'sourceCode.js', 'sourceCode.txt']; // Files to skip, adjust as needed
const projectDirectory = '/Users/bogdanionutcoman/dev-projects/GitHub/wingman'; // Your project's root directory
const outputFile = 'sourceCode.txt'; // Output file


function isDirectory(filePath) {
    return fs.statSync(filePath).isDirectory();
}

function shouldSkipDirectory(directory) {
    return skipDirectories.includes(directory);
}

function shouldSkipFile(file) {
    return skipFiles.includes(file);
}

function concatenateScripts(directory, isRoot = true) {
    fs.readdirSync(directory).forEach(file => {
        if (isRoot && shouldSkipFile(file)) {
            return; // Skip the file if it's in the list and we're in the root directory
        }
        
        const filePath = path.join(directory, file);

        if (isDirectory(filePath)) {
            if (!shouldSkipDirectory(file)) {
                concatenateScripts(filePath, false); // Recurse into subdirectories, marking as not root
            }
        } else if (file.endsWith('.js')) { // Target JavaScript files
            const content = fs.readFileSync(filePath, 'utf8');
            const scriptHeader = `\n\n/* File: ${filePath} */\n\n`;
            fs.appendFileSync(outputFile, scriptHeader + content);
        }
    });
}

// Ensure the output file is empty before starting
fs.writeFileSync(outputFile, '');

// Start the script concatenation process from the root directory
concatenateScripts(projectDirectory);

console.log(`Scripts have been concatenated into ${outputFile}`);
