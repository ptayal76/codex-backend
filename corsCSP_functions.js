const axios = require("axios");
const dotenv = require("dotenv");
const { URL } = require("url");
const https = require('https');

dotenv.config();
const checkCors = async (inputUrl, domain) => {
  const url = `${inputUrl}/api/rest/2.0/auth/token/full`;

  const payload = JSON.stringify({
      "username": "tsadmin",
      "validity_time_in_sec": 3000,
      "org_id": 0,
      "password": "admin",
      "user_parameters": {
          "runtime_filters": [
              {
                  "column_name": "Color",
                  "operator": "IN",
                  "values": [
                      "red",
                      "green"
                  ],
                  "persist": true
              }
          ],
          "parameters": [],
          "runtime_sorts": []
      }
  });

  const headers = {
      'accept': 'application/json',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'content-type': 'application/json',
      'origin': domain,
      'priority': 'u=1, i',
      'referer': domain,
      'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site'
  };
  let reachable = "TRUE";

  const agent = new https.Agent({  
      rejectUnauthorized: false
  });

  try {
      const optResp = await axios.options(url, { headers: headers, data: payload, timeout: 5000, httpsAgent: agent });
      
      if (optResp.status === 204) {
          return ["PASS", "TRUE"];
      } else if (optResp.status === 404) {
          return ["FAIL", "TRUE"];
      } 
      // else {
      //     return ["UNVERIFIED", "TRUE"];
      // }
  } catch (error) {
      if (error.code === 'ECONNABORTED') {
          // Handle timeout error
          return ["UNVERIFIED", "TIMEOUT"]; // Assuming TIMEOUT status needs to be handled separately
      } else if (error.response) {
        reachable = `HTTP error occurred: ${error.response.statusText}`;
    } else if (error.request) {
        reachable = `No response received: ${error.message}`;
    } else {
        reachable = `Request error occurred: ${error.message}`;
    }
    console.log(err)
}
return ["UNVERIFIED", reachable];
};


const checkCsp = async (inputUrl, domain) => {
  const url = `${inputUrl}/callosum/v1/v2/auth/session/login`;
  const payload = 'username=abc&password=secret&remember_me=false';
  const headers = {
    'Accept': "application/json",
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  try {
    console.log("corsss");
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.post(url, payload, { headers: headers, httpsAgent: httpsAgent });
    return processResponse(response, domain);
  } catch (error) {
    if (error.response) {
      return processResponse(error.response, domain);
    } else {
      return ["UNVERIFIED", `HTTP error occurred: ${error.message}`];
    }
  }
};

const processResponse = (response, domain) => {
  const domainMatchList = [domain];

  const domainItems = domain.split("//");
  const protocol = domainItems[0] + "//";
  const subDomains = domainItems[1].split(".");

  let postSuffix = "";
  for (const item of subDomains.reverse()) {
    const suffix = item + postSuffix;
    if (suffix === domainItems[1]) {
      break;
    }
    domainMatchList.push(protocol + "*." + suffix);
    postSuffix = "." + suffix;
  }

  const cspContent = response.headers["content-security-policy"];
  let cspStatus = "FAIL";

  if (cspContent) {
    for (const cspItem of cspContent.split(";")) {
      const trimmedCspItem = cspItem.trim();
      if (trimmedCspItem.startsWith("frame-ancestors")) {
        for (const value of trimmedCspItem.split(" ")) {
          if (value === "*" || domainMatchList.includes(value)) {
            cspStatus = "PASS";
            break;
          }
        }
      }
    }
  }

  return [cspStatus, cspContent];
};

const CheckCorsCSP = async (inputUrl, domain) => {
    console.log("hi")
  const [corsStatus, reachable] = await checkCors(inputUrl, domain);
  const response = {
    thoughtspot_cluster: inputUrl,
    Reachable: reachable,
    embed_domain: domain,
    cors_status: corsStatus,
  };
console.log(response)
  if (corsStatus === "PASS") {
    const [cspStatus, cspContent] = await checkCsp(inputUrl, domain);
    response.csp_status = cspStatus;
    response.csp_content = cspContent;
  } else {
    response.csp_status = "UNVERIFIED";
    response.csp_content = "";
  }

  return JSON.stringify(response, null, 4);
};

module.exports = { CheckCorsCSP };
