# Change log

## 0.10.3 (2026-01-13)

### Changes:

1. Option to decode HTML Entities in links

## 0.10.2 (2025-11-26)

### Changes:

1. Support multi value for Salesforce Channel filter

## 0.10.1 (2025-10-28)

### Changes:

1. Added OAuth Client Credentials Flow support for Salesforce

## 0.9.13 (2025-05-23)

### Changes:

1. Added the total number of processed items to the logs

## 0.9.12 (2025-05-14)

### Fixes:

1. Remove redundant version reading logic: only read version from package when environment variable is not set

## 0.9.11 (2025-04-30)

### Changes:

1. Adding customizable user agent option, separated for source and destination requests
2. Adding user agent to image fetching

## 0.9.10 (2025-04-04)

### Changes:

1. Added logs to double-check documents that are going to be deleted

## 0.9.9 (2025-04-03)

### Changes:

1. Added OAuth authentication type to ServiceNow

## 0.9.8 (2025-04-03)

### Fixes:

1. Updated pagination handling: next page results are now added to unprocessedItems collection

### Changes:

1. Added duplicate filter to prevent syncing multiple articles with the same external ID

## 0.9.7 (2025-03-20)

### Fixes:

1. Empty export exclude won't be sent, preventing validation error during export

## 0.9.6 (2025-03-20)

### Changes:

1. Added filter tasks for conditional pipeline processing

## 0.9.5 (2025-03-19)

### Changes:

1. Reduced export when compare mode is ModificationDate

## 0.9.4 (2025-03-19)

### Fixes:

1. ServiceNow Adapter unit test regarding 0.9.3 fix

## 0.9.3 (2025-03-18)

### Fixes:

1. ServiceNow Adapter does not swallow Interrupted error

## 0.9.2 (2025-03-13)

### Changes:

1. API calls are retried on error

## 0.9.1 (2025-02-25)

### Changes:

1. ApiError contains nested error

## 0.9.0 (2025-02-24)

### Changes:

1. Introduce COMPARE_MODE env variable for difference checking

## 0.8.5 (2025-02-05)

### Changes:

1. Entities failed to convert are now also included into the sync JSON and also uploaded
   to Genesys Cloud Knowledge

## 0.8.4 (2025-02-05)

### Bugfix:

1. Log level env variable lower case

## 0.8.3 (2025-02-05)

### Bugfix:

1. Reading package.json version from working directory

## 0.8.2 (2025-02-03)

### Changes:

1. Updated knowledge-html-converter dependency

## 0.8.1 (2025-02-03)

### Changes:

1. Introduce LOG_LEVEL env variable to control logger

## 0.8.0 (2025-01-29)

### Breaking changes:

1. The entity processing now happens one by one instead of the previous all at once.
2. ServiceNow adapter fetches the categories from Table API.

