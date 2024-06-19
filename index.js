// index.js

const { getAllClusterInfo } = require('./clusterFunctions.js'); // Replace 'yourFileName' with the actual filename where getAllClusterInfo is defined

// Example usage
async function main() {
    try {
        const clusterInfo = await getAllClusterInfo('metadata', 'prod');
        if (clusterInfo) {
            console.log('Cluster Info:', clusterInfo);
        }
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

// Call the main function
main();
