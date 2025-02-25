# Change log

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

