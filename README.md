# Knowledge Connector App

## Resources

- Open source project repository: https://github.com/MyPureCloud/knowledge-connector-app
- Project documentation: https://github.com/MyPureCloud/knowledge-connector-app/wiki
- Knowledge HTML Converter library: https://github.com/MyPureCloud/knowledge-html-converter

## Prerequisites

- Node.js (Version 18.x or higher)

## Configuration

The app needs configuration for source and destination adapters as well.  
The source adapter section contains configuration for API requests used to retrieve data from an external knowledge
base.
Based on the type of the source adapter the number and the name of variables can differ.  
The destination adapter section contains configuration for sending data to your Genesys Cloud Organization.

The configuration can be set either as Environment Variables or in a `.env` file.  
Documentation for using dotenv: https://github.com/motdotla/dotenv#%EF%B8%8F-usage

### The configurer

The `CONFIGURER` variable defines in which folder should the app find the configurer method.
Each adapter has its own configurer method which adds to the pipe all the necessary tasks for that specific adapter.

### Configure Zendesk as source

```
CONFIGURER=zendesk
# The base url for Zendesk API (eg. https://<company>.zendesk.com)
ZENDESK_BASE_URL=
# Username and password for API authentication
ZENDESK_USERNAME=
ZENDESK_PASSWORD=
# The articles language to be synced
ZENDESK_LOCALE=
```

### Configure Salesforce as source

```
CONFIGURER=salesforce
# The login url for Salesforce API (eg. https://login.salesforce.com)
SALESFORCE_LOGIN_URL=
# The base url for Salesforce API (eg. https://<company>.my.salesforce.com)
SALESFORCE_BASE_URL=
# Used Salesforce API version (eg. v56.0)
SALESFORCE_API_VERSION=
# Username, password, clientId, cliendSecret for API authentication
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
# Used language code (eg. en-us)
SALESFORCE_LANGUAGE_CODE=
# Names of article fields that contain parts of the content as comma separated values (eg. Question__c,Answer__c)
SALESFORCE_ARTICLE_CONTENT_FIELDS=
# Base url for Salesforce lightning. Used for optional external article self url generation
SALESFORCE_LIGHTNING_BASE_URL=
```

###### Optional parameters
```
# The visibility of the articles (App, Pkb, Csp, Prm)
SALESFORCE_CHANNEL=
# The category filter to be used for fetching articles. 
# Format: 
#  {"<categoryGroup name #1>": "<category name #1>", "<categoryGroup name #2>": "<category name #2>"}
SALESFORCE_CATEGORIES=
```

### Configure ServiceNow as source

```
CONFIGURER=servicenow
# The base url for ServiceNow API (eg. https://<company>.service-now.com)
SERVICENOW_BASE_URL=
# Username, password
SERVICENOW_USERNAME=
SERVICENOW_PASSWORD=
```

###### Optional parameters
```
# The maximum number of articles to be synced
LIMIT=10
# The knowledge bases to be synced. Comma separated knowledge base ids
SERVICENOW_KNOWLEDGE_BASES=
# The articles language to be synced (eg. en)
SERVICENOW_LANGUAGE=
# The category filter to be used for fetching articles. Comma separated category ids
SERVICENOW_CATEGORIES=
```

### Configure Genesys Cloud as source

```
CONFIGURER=genesys
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

### Optional parameters

#### External ID prefix

```
# All the IDs from the source system will be extended with this string
EXTERNAL_ID_PREFIX=
```

#### Protected fields

```
# Fields that you don't want to update in Genesys Cloud can be listed here as comma separated values.
# For example protecting alternative phrases with "published.alternatives" from being overwritten.
PROTECTED_FIELDS=
```

#### Suffix to prevent name conflicts

```
# Entities from different sources may have the same name, which may cause synchronization problems.  
# To prevent overwriting each other you can define a suffix which is appended to the conflicting names.   
NAME_CONFLICT_SUFFIX=
```

#### Relative image URL handling

```
# Base url for relative image urls
RELATIVE_IMAGE_BASE_URL=
```

#### Allow image loading from local filesystem

```
# When enabled, image tags with "file:" are processed and uploaded to destination.
# Disabled by default.
ALLOW_IMAGE_FROM_FILESYSTEM=true
```

#### Execution timeout

```
# Terminates the application after the set timeout in seconds has been reached.
KILL_AFTER_LONG_RUNNING_SECONDS=
```

#### Fetch certain entity types only

```
# Fetch articles from 3rd party. Values: 'true' or 'false'. Default 'true'. 
FETCH_ARTICLES=
# Fetch categories from 3rd party. Values: 'true' or 'false'. Default 'true'.
FETCH_CATEGORIES=
# Fetch labels from 3rd party. Values: 'true' or 'false'. Default 'true'.
FETCH_LABELS=
```

#### Update links

```
# Update document links, so they point to their synced document counterpart in destination instead of source. Values: 'true' or 'false'. Default 'false'.
UPDATE_DOCUMENT_LINKS=
# Generate and attach an external url field to the articles that will point to the article in the source system. Values: 'true' or 'false'. Default 'false'.
BUILD_EXTERNAL_URLS=
```

#### Attachment (image) download allow-list

```
# Comma-separated list of domains names. If specified, images are downloaded only from these source domains (or their subdomains)
# and uploaded to the destination. Images from other domains are not downloaded and their urls are left unchanged. If left empty,
# images are downloaded from any domains. Example value: api-cdn.mypurecloud.com,api-cdn.mypurecloud.de
ATTACHMENT_DOMAIN_ALLOW_LIST=
```

### Installation

1. Install dependencies `npm install`
2. Build the project `npm run build`

### Run the application

1. Run `npm start`
