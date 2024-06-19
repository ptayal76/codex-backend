const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

module.exports = {
    hostnameProd: process.env.HOSTNAME_PROD,
    hostnameDev: process.env.HOSTNAME_DEV,
    hostnameStaging: process.env.HOSTNAME_STAGING,
    headersProd: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${process.env.PROD_TOKEN}`
    },
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    gcpAuth: process.env.GCP_TOKEN,
    headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
};
