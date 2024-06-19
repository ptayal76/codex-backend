require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
const stateToken = process.env.KIBANA_STATE_TOKEN;
const refreshToken = process.env.KIBANA_REFRESH_TOKEN;

// Define the URLs
const url = "https://vpc-cosmos-logs-4wtep3mnjhirrckhgaaqedsrtq.us-west-2.es.amazonaws.com";
const prodUrl = "https://vpc-cosmos-logs-vtnxecylwjjggwhuqg66jqrw6y.us-east-1.es.amazonaws.com";

// Main function
const fetchKibana = async (cluster_id, initial_time, end_time) => {
    // console.log({stateToken,refreshToken})
    const payload = {
        "params": {
            "index": "tenant-*",
            "body": {
                "version": true,
                "size": 2000,
                "sort": [
                    {
                        "@timestamp": {
                            "order": "desc",
                            "unmapped_type": "boolean"
                        }
                    }
                ],
                "aggs": {
                    "2": {
                        "date_histogram": {
                            "field": "@timestamp",
                            "calendar_interval": "1h",
                            "time_zone": "UTC",
                            "min_doc_count": 1
                        }
                    }
                },
                "stored_fields": [
                    "*"
                ],
                "script_fields": {},
                "docvalue_fields": [
                    {
                        "field": "@timestamp",
                        "format": "date_time"
                    }
                ],
                "_source": {
                    "excludes": [
                        "auto_complete"
                    ]
                },
                "query": {
                    "bool": {
                        "must": [],
                        "filter": [
                            {
                                "match_all": {}
                            },
                            {
                                "match_phrase": {
                                    "cluster_id": cluster_id
                                }
                            },
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": initial_time,
                                        "lte": end_time,
                                        "format": "strict_date_optional_time"
                                    }
                                }
                            }
                        ],
                        "should": [],
                        "must_not": []
                    }
                },
                "highlight": {
                    "pre_tags": [
                        "@kibana-highlighted-field@"
                    ],
                    "post_tags": [
                        "@/kibana-highlighted-field@"
                    ],
                    "fields": {
                        "*": {}
                    },
                    "fragment_size": 2147483647
                }
            },
            "rest_total_hits_as_int": true,
            "ignore_unavailable": true,
            "ignore_throttled": true,
            "preference": 1717735704857,
            "timeout": "60000ms"
        }
    };

    const headers = {
        'accept': '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'content-type': 'application/json',
        'cookie': `STATE-TOKEN=${stateToken}; REFRESH-TOKEN=${refreshToken}`,
        'kbn-version': '7.9.1',
        'origin': url,
        'priority': 'u=1, i',
        'referer': `${url}/_plugin/kibana/app/discover`,
        'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    };

    try {
        const response = await axios.post(`${url}/_plugin/kibana/internal/search/es`, payload, {
            headers: headers
        });

        const parsedData = response.data;
        return JSON.stringify(parsedData, null, 4);
    } catch (error) {
        console.error('Error making request:', error.message);
    }
};

// Call the main function with appropriate arguments
module.exports = {fetchKibana}
