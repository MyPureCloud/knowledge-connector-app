# Knowledge Connector App

## Resources
- Open source project repository: https://github.com/MyPureCloud/knowledge-connector-app
- Project documentation: https://github.com/MyPureCloud/knowledge-connector-app/wiki
- Knowledge HTML Converter library: https://github.com/MyPureCloud/knowledge-html-converter

## Prerequisites

- Node.js (Version 18.x or higher)

## Configuration

The app needs configuration for source and destination adapters as well.  
The source adapter section contains configuration for API requests used to retrieve data from an external knowledge base. 
Based on the type of the source adapter the number and the name of variables can differ.  
The destination adapter section contains configuration for sending data to your Genesys Cloud Organization.

The configuration can be set either as Environment Variables or in a `.env` file.  
Documentation for using dotenv: https://github.com/motdotla/dotenv#%EF%B8%8F-usage

### Configure Zendesk as source 
```
# The base url for Zendesk API (eg. https://<company>.zendesk.com)
ZENDESK_BASE_URL=
# Username and password for API authentication
ZENDESK_USERNAME=
ZENDESK_PASSWORD=
# The articles language to be synced
ZENDESK_LOCALE=
```

### Configure Genesys Cloud as source
```
GENESYS_SOURCE_LOGIN_URL=https://login.mypurecloud.com
GENESYS_SOURCE_BASE_URL=https://api.mypurecloud.com
GENESYS_SOURCE_CLIENT_ID=
GENESYS_SOURCE_CLIENT_SECRET=
GENESYS_SOURCE_KNOWLEDGE_BASE_ID=
```

### Configure destination
```
GENESYS_LOGIN_URL=https://login.mypurecloud.com
GENESYS_BASE_URL=https://api.mypurecloud.com
GENESYS_CLIENT_ID=
GENESYS_CLIENT_SECRET=
GENESYS_KNOWLEDGE_BASE_ID=
```

### Configure image handling
```
# Base url for relative image urls
RELATIVE_IMAGE_BASE_URL=
```

### Installation

1. Install dependencies `npm install`
2. Build the project `npm run build`

### Run the application
 
1. Run `npm start`
