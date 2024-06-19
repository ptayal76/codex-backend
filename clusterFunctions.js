const axios = require('axios');
const fs = require('fs').promises;
const {
    hostnameProd,
    hostnameDev,
    hostnameStaging,
    headersProd,
    username,
    password,
    headers,
    gcpAuth
} = require('./config');
async function getAllClusterInfo(clusterName, env) {
    let page = 0;
    const size = 100;
    let clusterStateList = true;
    let clusterDetails = null;
    let commands = [];
    let patches = [];
    let clusterId = null;
    let upgradeVersion = null;
    let currentVersion = null;
    let versionFound = false;

    try {
        while (clusterStateList) {
            let url;
            let response1;

            if (env === 'prod') {
                url = `${hostnameProd}/api/v2/clusters/state?page=${page}&size=${size}`;
                response1 = await axios.get(url, { headers: headersProd });
            } else if (env === 'dev') {
                url = `${hostnameDev}/api/v2/clusters/state?page=${page}&size=${size}`;
                response1 = await axios.get(url, { auth: { username, password }, headers });
            } else {
                url = `${hostnameStaging}/api/v2/clusters/state?page=${page}&size=${size}`;
                response1 = await axios.get(url, { auth: { username, password }, headers });
            }

            clusterStateList = response1.data.clusterStateList;

            if (!clusterStateList || clusterStateList.length === 0) {
                break;
            }

            for (const cluster of clusterStateList) {
                if (cluster.clusterName === clusterName && cluster.operationalState !== 'DELETE') {
                    clusterId = cluster.clusterId;
                    clusterDetails = cluster;
                }
            }

            page += 1;
        }

        if (!clusterId) {
            console.log(`Cluster ${clusterName} not found`);
            return null;
        }

        let url;
        let response2;

        if (env === 'prod') {
            url = `${hostnameProd}/api/v2/workflows/clusters/${clusterId}`;
            response2 = await axios.get(url, { headers: headersProd });
        } else if (env === 'dev') {
            url = `${hostnameDev}/api/v2/workflows/clusters/${clusterId}`;
            response2 = await axios.get(url, { auth: { username, password }, headers });
        } else {
            url = `${hostnameStaging}/api/v2/workflows/clusters/${clusterId}`;
            response2 = await axios.get(url, { auth: { username, password }, headers });
        }

        const workflowDetails = response2.data;

        for (const workflow of workflowDetails) {
            if (workflow.metadata) {
                if (workflow.metadata.command) {
                    commands.push(workflow.metadata.command);
                }
                if (workflow.metadata.patch_id) {
                    patches.push(workflow.metadata.patch_id);
                }
            }
            if (!versionFound && workflow.workflowType === 'Cluster-Upgrade') {
                if (workflow.status === 'SUCCEEDED') {
                    if (workflow.metadata) {
                        if (workflow.metadata.current_version) {
                            currentVersion = workflow.metadata.current_version;
                        }
                        if (workflow.metadata.upgrade_version) {
                            upgradeVersion = workflow.metadata.upgrade_version;
                        }
                        versionFound = true;
                    }
                }
            }
        }

        return {
            clusterId,
            clusterDetails,
            commands,
            currentVersion,
            upgradeVersion,
            patches
        };
    } catch (error) {
        console.error(`Error fetching cluster information: ${error.message}`);
        throw error; // Re-throw the error after logging it
    }
}

async function getFlagDetails(clusterId, env) {
    let url, response;
    let flagDetails = {};
    let filteredServices = [];

    try {
        if (env === 'prod') {
            url = `${hostnameProd}/api/v2/clusters/${clusterId}/overrides`;
            response = await axios.get(url, { headers: headersProd });
        } else if (env === 'dev') {
            url = `${hostnameDev}/api/v2/clusters/${clusterId}/overrides`;
            response = await axios.get(url, { auth: { username, password }, headers });
        } else {
            url = `${hostnameStaging}/api/v2/clusters/${clusterId}/overrides`;
            response = await axios.get(url, { auth: { username, password }, headers });
        }

        const data = response.data;
        console.log(data)
        if (data.services) {
            for (const service of data.services) {
                const filteredService = {};

                if (service.tasks) {
                    const filteredTasks = [];

                    for (const task of service.tasks) {
                        const filteredTask = {};

                        if (task.flags) {
                            const filteredFlags = [];

                            for (const flag of task.flags) {
                                if (flag.overriden === true) {
                                    filteredFlags.push({
                                        name: flag.name,
                                        value: flag.value
                                    });
                                }
                            }

                            if (filteredFlags.length > 0) {
                                filteredTask.flags = filteredFlags;
                            }
                        }

                        if (filteredTask.name) {
                            filteredTask.name = task.name;
                            filteredTasks.push(filteredTask);
                        }
                    }

                    if (filteredTasks.length > 0) {
                        filteredService.tasks = filteredTasks;
                    }
                }

                if (filteredService.name) {
                    filteredService.name = service.name;
                    filteredServices.push(filteredService);
                }
            }

            if (filteredServices.length > 0) {
                flagDetails.services = filteredServices;
            }
        }

        return flagDetails;
    } catch (error) {
        console.error(`Error fetching flag details: ${error.message}`);
        throw error;
    }
}

async function createAWSSaasCluster(clusterName, ownerEmail, imageTag, feature, team) {

    const url = `${hostnameDev}/api/v2/clusters`;

    const commonTags = {
        "Owner": ownerEmail,
        "Team": team,
        "Source": "Nebula",
        "IntendedUse": "Development",
        "BusinessUnit": "Engineering",
        "Project": feature
    };

    const requestBody = {
        "CustomerID": clusterName,
        "BaseReleaseVersion": imageTag,
        "CustomAMI": "",
        "AssetID": clusterName,
        "AdminEmail": ownerEmail,
        "Environment": "AWS",
        "NebulaRequest": true,
        "OpportunityID": clusterName,
        "ProductSKU": ["TS-100S-1-ENT-PROD-500U-CLOUD"],
        "CloudConsumption": "100M",
        "Region": "us-west-2",
        "RequestedCustomerURL": clusterName,
        "Paid": false,
        "Timezone": "GMT-05:00",
        "TestInstance": false,
        "MultiNode": false,
        "Okta": false,
        "Ear": false,
        "DiskSize": "",
        "commonTags": commonTags
    };

    try {
        const response = await axios.post(url, requestBody, {
            auth: {
                username: username,
                password: password
            },
            headers: headers
        });

        return response.status;
    } catch (error) {
        console.error('Error creating AWS SaaS cluster:', error);
        throw error;
    }
}

async function createGCPSaasCluster(clusterName, ownerEmail, imageTag) {
    const url = "https://ops.internal.thoughtspotdev.cloud/api/v1/kube-server/apis/thoughtspot.com/v2/namespaces/cosmos/tenants";

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": gcpAuth
    };

    const requestBody = {
        "apiVersion": "thoughtspot.com/v2",
        "kind": "Tenant",
        "metadata": {
            "name": "replace-with-id",
            "namespace": "cosmos"
        },
        "spec": {
            "adminEmail": ownerEmail,
            "applyFleetPatches": true,
            "billingModel": "Query",
            "data_disk_size": 200,
            "dns": clusterName,
            "dryRun": false,
            "enableWakeupKey": false,
            "env": {
                "atomID": "1dd1a600-92ba-462e-b745-d8fc8d1b1e80",
                "cellID": "611a9ce4-63f0-4979-a43a-98e10b39",
                "cloud": "GCP",
                "gcp": {
                    "project": "ts-dev-03",
                    "region": "us-east4"
                },
                "tenantID": ""
            },
            "eulaGracePeriod": 0,
            "fasterDeliveryEnabled": false,
            "idlesenseEnabled": false,
            "isClusterIdle": false,
            "maintenance": false,
            "mode": "Active",
            "nodeType": "e2-highmem-8",
            "paid": false,
            "productType": "ENTERPRISE",
            "release": imageTag,
            "sku": "ts-100s-1-ent-prod-500u-cloud-pot",
            "tags": {
                "classification": "restricted",
                "ephemeral": false
            },
            "useSpotVM": true
        }
    };

    try {
        const response = await axios.post(url, requestBody, { headers });
        return response.status;
    } catch (error) {
        console.error(`Error: ${error.response ? error.response.status : error.message}`);
        return error.response ? error.response.status : 500;
    }
}

async function getClusterVersion(clusterName, env) {
    let page = 0;
    const size = 100;
    let clusterStateList = true;
    let clusterId = null;

    try {
        while (clusterStateList) {
            let url;
            let response;

            if (env === 'prod') {
                url = `${hostnameProd}/api/v2/clusters/state?page=${page}&size=${size}`;
                response = await axios.get(url, { headers: headersProd });
            } else if (env === 'dev') {
                url = `${hostnameDev}/api/v2/clusters/state?page=${page}&size=${size}`;
                response = await axios.get(url, { auth: { username, password }, headers });
            } else {
                url = `${hostnameStaging}/api/v2/clusters/state?page=${page}&size=${size}`;
                response = await axios.get(url, { auth: { username, password }, headers });
            }

            clusterStateList = response.data.clusterStateList;

            if (!clusterStateList || clusterStateList.length === 0) {
                break;
            }

            for (const cluster of clusterStateList) {
                if (cluster.clusterName === clusterName && cluster.operationalState !== 'DELETE') {
                    clusterId = cluster.clusterId;
                }
            }

            page += 1;
        }

        if (!clusterId) {
            console.log(`Cluster ${clusterName} not found`);
            return null;
        }

        return clusterId;
    } catch (error) {
        console.error(`Error fetching cluster version: ${error.message}`);
        throw error;
    }
}

async function applyPatches(clusterName,userEmail, patchIds, env) {
    const clusterId = await getClusterVersion(clusterName, env);
    if (!clusterId) {
        console.log(`Cluster ${clusterName} not found`);
        return null;
    }
    console.log(clusterId);

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Email": userEmail
    };

    let url;
    if (env === "prod") {
        url = `${hostnameProd}/api/v2/clusters/patch`;
        headers["Authorization"] = `Basic ${prodToken}`;
    } else if (env === "dev") {
        url = `${hostnameDev}/api/v2/clusters/patch`;
    } else {
        url = `${hostnameStaging}/api/v2/clusters/patch`;
    }

    for (const patchId of patchIds) {
        const data = {
            "clusterIds": [clusterId],
            "patchId": patchId
        };

        try {
            let response;
            if (env === "prod") {
                response = await axios.post(url, data, { headers: headersProd });
            } else {
                response = await axios.post(url, data, {
                    auth: {
                        username: username,
                        password: password
                    },
                    headers: headers
                });
            }

            if (response.status >= 200 && response.status<300) {
                console.log(response);
                console.log(`Error applying patch ${patchId}`);
            } else {
                console.log(`Patch ${patchId} applied successfully`);
            }
        } catch (error) {
            console.error(`Error applying patch ${patchId}:`, error.message);
        }
    }

    return 200; // Assuming the last patch application was successful
}

async function applyTSCLICommands(clusterName,userEmail,commands, env) {
    try {
        const clusterId = await getClusterVersion(clusterName, env);
        if (!clusterId) {
            console.log(`Cluster ${clusterName} not found`);
            return null;
        }

        for (const command of commands) {
            const data = {
                clusterIds: [clusterId],
                command: command,
                runHost: "",
                runOnAllNodes: true
            };

            const headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Email": userEmail
            };

            let url;
            let response;

            if (env === 'prod') {
                url = `${hostnameProd}/api/v2/clusters/configure`;
                headers["Authorization"] = `Basic ${prodToken}`;
                response = await axios.post(url, data, { headers: headersProd });
            } else if (env === 'dev') {
                url = `${hostnameDev}/api/v2/clusters/configure`;
                response = await axios.post(url, data, { auth: { username, password }, headers });
            } else {
                url = `${hostnameStaging}/api/v2/clusters/configure`;
                response = await axios.post(url, data, { auth: { username, password }, headers });
            }

            console.log(response.status, response.data);

            if (response.status < 200 || response.status > 299) {
                console.log(`Error applying command ${command}`);
            }
        }

        return response;
    } catch (error) {
        console.error(`Error applying TSCLI commands: ${error.message}`);
        throw error;
    }
}

module.exports = { getAllClusterInfo,getFlagDetails,createAWSSaasCluster,applyPatches,getClusterVersion,applyTSCLICommands,createGCPSaasCluster };
