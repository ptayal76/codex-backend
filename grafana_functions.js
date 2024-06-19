const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { format, parseISO } = require('date-fns');
const { createObjectCsvStringifier } = require('csv-writer');
const StringWriter = require('string-writer');

// Load environment variables from .env file
dotenv.config();

const grafanaToken = process.env.GRAFANA_TOKEN;

const url = "https://thoughtspot.grafana.net/api/ds/query";

const metricKeys = ['time', 'api', 'cluster', 'collection_level', 'error', 'method', 'org_id', 'rel_version', 'saas_env', 'service_name', 'status', 'tenant_id', 'tenant_name', 'duration'];

const makeQueryDict = (queryRefId, queryExpr) => {
    return {
        refId: queryRefId,
        datasourceId: 4,
        expr: queryExpr,
        interval: "600",
        maxDataPoints: 1000,
        instant: false,
        range: true,
        format: "table"
    };
};

const processApiMetricFrames = async (apiMetricFramesList, csvStringifier, stringWriter) => {
    for (const apiMetricFrame of apiMetricFramesList) {
        let timestampIndex = 0;
        let durationValueIndex = 1;
        const apiMetricSample = {};

        // Initialize the metric sample with empty strings
        metricKeys.forEach(key => {
            apiMetricSample[key] = '';
        });

        apiMetricFrame.schema.fields.forEach((field, fieldIndex) => {
            if (field.name === "Time") {
                timestampIndex = fieldIndex;
            }

            if (field.labels) {
                const labels = field.labels;
                if (labels.api) apiMetricSample.api = labels.api;
                if (labels.cluster) apiMetricSample.cluster = labels.cluster;
                if (labels.collection_level) apiMetricSample.collection_level = labels.collection_level;
                if (labels.error) apiMetricSample.error = labels.error;
                if (labels.method) apiMetricSample.method = labels.method;
                if (labels.org_id) apiMetricSample.org_id = labels.org_id;
                if (labels.rel_version) apiMetricSample.rel_version = labels.rel_version;
                if (labels.saas_env) apiMetricSample.saas_env = labels.saas_env;
                if (labels.service_name) apiMetricSample.service_name = labels.service_name;
                if (labels.status_code) apiMetricSample.status = labels.status_code;
                if (labels.status) apiMetricSample.status = labels.status;
                if (labels.tenant_id) apiMetricSample.tenant_id = labels.tenant_id;
                if (labels.tenant_name) apiMetricSample.tenant_name = labels.tenant_name;
            }
        });

        if (timestampIndex === 1) {
            durationValueIndex = 0;
        }

        if (apiMetricFrame.data.values.length > 0) {
            for (let itemIndex = 0; itemIndex < apiMetricFrame.data.values[timestampIndex].length; itemIndex++) {
                const timestampValue = apiMetricFrame.data.values[timestampIndex][itemIndex];
                apiMetricSample.time = format(new Date(timestampValue), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                apiMetricSample.duration = apiMetricFrame.data.values[durationValueIndex][itemIndex];

            }
        }
        // Write the sample to the string writer
        stringWriter.write(csvStringifier.stringifyRecords([apiMetricSample])); // Ensure sequential writing
    }
};

const collectApiMetricUsage = async (csvStringifier, stringWriter, startTime, endTime, queryList) => {
    console.log(`Collecting API metric data FROM "${startTime}" TO "${endTime}"`);

    const payload = {
        queries: queryList,
        from: startTime,
        to: endTime
    };
    console.log(payload);
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grafanaToken}`
    };

    try {
        const response = await axios.post(url, payload, { headers });
        const result = response.data;

        if (!result.results) {
            console.log(JSON.stringify(result, null, 4));
            process.exit(1);
        }

        for (const query of queryList) {
            // console.log(query.expr);
            const apiMetricFramesList = result.results[query.refId].frames;
            await processApiMetricFrames(apiMetricFramesList, csvStringifier, stringWriter);
        }
    } catch (error) {
        console.error('Error fetching API metric usage:', error);
        process.exit(1);
    }
};

const startRestApiMetricCollection = async (inputStartDate, inputEndDate, metricName, saasEnv, apiRegex, tenantName, statusCodeRegex) => {
    const inputStartDateTime = parseISO(inputStartDate);
    const inputEndDateTime = parseISO(inputEndDate);

    const startTimeStr = format(inputStartDateTime, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    const endTimeStr = format(inputEndDateTime, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    const stringWriter = new StringWriter();
    const csvStringifier = createObjectCsvStringifier({
        header: metricKeys.map(key => ({ id: key, title: key })),
    });

    // Write the header
    stringWriter.write(csvStringifier.getHeaderString());

    console.log("Starting data collection");

    const queryList = [];
    queryList.push(
        makeQueryDict(
            "prism-public-rest-api-v2-query",
            `${metricName}{saas_env=~"${saasEnv}", api=~"${apiRegex}", tenant_name=~".*${tenantName}.*", quantile="0.95", status_code=~"${statusCodeRegex}"}`
        )
    );

    await collectApiMetricUsage(csvStringifier, stringWriter, startTimeStr, endTimeStr, queryList);
    console.log("Completed fetching Grafana");

    return stringWriter.toString();
};

module.exports= { startRestApiMetricCollection };
