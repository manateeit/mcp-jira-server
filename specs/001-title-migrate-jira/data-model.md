# Data Model: Enhanced JQL API Migration

## Core Entities

### JiraIssue
Represents a single Jira issue returned by the Enhanced JQL API.

**Fields:**
- `id` (string): Unique issue identifier  
- `key` (string): Human-readable issue key (e.g., "AIS360-123")
- `self` (string): REST API URL for the issue
- `fields` (object): Issue field data based on field selection
  - Dynamic structure based on requested fields
  - Common fields: summary, description, status, assignee, created, updated

**Validation Rules:**
- `id` must be non-empty string
- `key` must match Jira key format pattern
- `self` must be valid URL

### SearchRequest
Represents the parameters for a Jira issue search operation.

**Fields:**
- `jql` (string, required): JQL query expression
- `maxResults` (number, optional): Maximum results to return (default: 50, max: 100)
- `fields` (string[] | "*all", optional): Fields to include in response
- `expand` (string[], optional): Additional data to expand
- `cursor` (string, optional): Pagination cursor token
- `method` ("auto" | "GET" | "POST", optional): HTTP method selection

**Validation Rules:**
- `jql` must be non-empty string
- `maxResults` must be 1-100
- `fields` array items must be valid field names
- `cursor` must be valid token format when present

**State Transitions:**
- Initial request: cursor = null
- Paginated request: cursor = token from previous response
- Final page: cursor = null in response

### SearchResponse  
Represents the response from Enhanced JQL API search operation.

**Fields:**
- `issues` (JiraIssue[]): Array of matching issues
- `total` (number, optional): Total count (may be undefined for cursor pagination)
- `cursor` (string | null): Next page token for pagination
- `meta` (ResponseMetadata): Operation metadata

**Validation Rules:**
- `issues` must be array (can be empty)
- `total` must be non-negative when present
- `cursor` must be null for final page

### ResponseMetadata
Contains operational metadata for search responses.

**Fields:**
- `timing` (object): Response timing information
  - `requestTime` (number): Request timestamp
  - `responseTime` (number): Response timestamp  
  - `duration` (number): Request duration in milliseconds
- `warnings` (string[], optional): API warnings or deprecation notices
- `rateLimit` (object, optional): Rate limiting information
  - `remaining` (number): Requests remaining in window
  - `resetTime` (number): Rate limit reset timestamp
  - `retryAfter` (number, optional): Seconds to wait if rate limited

### BackwardCompatibilityMapping
Handles mapping between old and new parameter formats.

**Legacy Parameter Mapping:**
- `limit` → `maxResults`
- `startAt` → converts to cursor navigation
- Maintains existing parameter names for zero-disruption migration

**Response Format Mapping:**
- Preserves old response structure
- Adds new `cursor` field for enhanced pagination
- Maintains `total` field when available

## Request/Response Flow

### Simple Query Flow
1. **Input**: SearchRequest with JQL query <1500 chars
2. **Processing**: GET request to `/rest/api/3/search/jql`
3. **Output**: SearchResponse with issues and cursor

### Complex Query Flow  
1. **Input**: SearchRequest with JQL query >1500 chars
2. **Processing**: POST request to `/rest/api/3/search/jql`
3. **Output**: SearchResponse with issues and cursor

### Pagination Flow
1. **First Page**: Request with cursor = null
2. **Subsequent Pages**: Request with cursor from previous response
3. **Final Page**: Response with cursor = null

## Error Handling Model

### JiraApiError
Represents errors returned by Jira Enhanced JQL API.

**Fields:**
- `errorMessages` (string[]): Human-readable error messages
- `errors` (object): Field-specific error details
- `status` (number): HTTP status code
- `warningMessages` (string[], optional): Non-fatal warnings

### Rate Limit Handling
- **Detection**: HTTP 429 status code
- **Response**: Include rate limit details in metadata
- **Retry Strategy**: Exponential backoff based on `Retry-After` header

## Field Selection Model

### Supported Field Types
- **System Fields**: Built-in Jira fields (id, key, summary, etc.)
- **Custom Fields**: Project-specific custom fields
- **Special Values**: 
  - `"*all"`: Include all available fields
  - `"*navigable"`: Include navigable fields only

### Field Request Mapping
- Array format: `["summary", "status", "assignee"]`
- Comma-separated string: `"summary,status,assignee"`  
- Special handling for backward compatibility

## Cursor Pagination Model

### Cursor Token Structure
- **Opaque**: Clients treat as black-box string
- **Server-Generated**: Created by Jira API
- **Stateless**: Contains all information needed for next page

### Navigation Pattern
```
Page 1: cursor = null → Response: { issues: [...], cursor: "token1" }
Page 2: cursor = "token1" → Response: { issues: [...], cursor: "token2" }
Page N: cursor = "tokenN-1" → Response: { issues: [...], cursor: null }
```

## Validation Rules Summary

### Input Validation
- JQL syntax validation delegated to Jira API
- Parameter type and range validation on client side
- URL encoding validation for GET requests

### Output Validation  
- Response structure validation against expected schema
- Cursor token format validation
- Issue field presence validation based on request

### Error Response Validation
- Standard Jira error format preservation
- HTTP status code mapping
- Error message structure consistency

## Relationships

### SearchRequest → SearchResponse
- One-to-one relationship per API call
- Cursor enables continuation relationship across calls

### SearchResponse → JiraIssue[]
- One-to-many relationship  
- Array may be empty for no results

### SearchRequest → BackwardCompatibilityMapping
- Transformation relationship
- Maps legacy parameters to new format

### ResponseMetadata → SearchResponse
- Composition relationship
- Provides operational context for each response