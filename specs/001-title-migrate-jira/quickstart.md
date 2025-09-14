# Quickstart: Enhanced JQL API Migration

## Test Scenarios Overview

This quickstart validates the Enhanced JQL API migration through comprehensive test scenarios that ensure backward compatibility and new functionality work correctly.

## Prerequisites

- Jira Cloud instance with AIS360 project access
- Valid API credentials (email + API token)
- Node.js 18+ environment
- MCP server development environment

## Test Scenario 1: Simple JQL Query (GET Method)

### Test Description
Validate that simple JQL queries use GET method and return expected results.

### Test Steps
1. **Setup**: Configure MCP tool with valid Jira credentials
2. **Execute**: Call `search-issues` with simple JQL query
3. **Validate**: Confirm GET method used and results returned

### Test Command
```bash
# MCP tool call
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "maxResults": 10
  }
}
```

### Expected Result
```json
{
  "issues": [
    {
      "id": "10001",
      "key": "AIS360-123",
      "self": "https://domain.atlassian.net/rest/api/3/issue/10001",
      "fields": {
        "summary": "Issue summary",
        "status": { "name": "Open" }
      }
    }
  ],
  "total": 1,
  "cursor": null,
  "meta": {
    "timing": {
      "duration": 200
    }
  }
}
```

### Success Criteria
- ✅ HTTP GET method selected automatically
- ✅ At least 1 issue returned for AIS360 project
- ✅ Response includes id, key, self, fields
- ✅ Meta information includes timing data

## Test Scenario 2: Complex JQL Query (POST Method)

### Test Description
Validate that complex JQL queries automatically use POST method.

### Test Steps
1. **Setup**: Prepare long JQL query (>1500 characters)
2. **Execute**: Call `search-issues` with complex query
3. **Validate**: Confirm POST method used and results returned

### Test Command
```bash
# Long JQL query to trigger POST method
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 AND (summary ~ 'authentication' OR summary ~ 'authorization' OR description ~ 'security' OR labels in ('security', 'auth', 'login', 'password', 'encryption', 'oauth', 'saml', 'ldap') OR component in ('Security Module', 'Auth Service', 'User Management', 'Access Control') OR fixVersion in ('2.1.0', '2.2.0', '3.0.0') OR assignee in (membersOf('security-team')) OR reporter in (membersOf('qa-team'))) AND status not in (Closed, Resolved, Done) AND created >= -30d ORDER BY priority DESC, created ASC",
    "maxResults": 5
  }
}
```

### Expected Result
```json
{
  "issues": [...],
  "cursor": "eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTIzIl19",
  "meta": {
    "timing": {
      "duration": 500
    }
  }
}
```

### Success Criteria
- ✅ HTTP POST method selected automatically
- ✅ Query executes successfully despite length
- ✅ Results returned with proper structure
- ✅ Response time under 2 seconds

## Test Scenario 3: Cursor-Based Pagination

### Test Description
Validate cursor-based pagination works correctly across multiple pages.

### Test Steps
1. **Execute**: First page request with small maxResults
2. **Validate**: Response includes cursor token
3. **Execute**: Second page request using cursor
4. **Validate**: Different results returned, cursor updated
5. **Continue**: Until cursor is null (final page)

### Test Commands
```bash
# Page 1
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "maxResults": 3
  }
}

# Page 2 (using cursor from page 1)
{
  "tool": "search-issues", 
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "maxResults": 3,
    "cursor": "eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTIzIl19"
  }
}
```

### Expected Results
**Page 1:**
```json
{
  "issues": [
    {"key": "AIS360-125"},
    {"key": "AIS360-124"}, 
    {"key": "AIS360-123"}
  ],
  "cursor": "eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTIzIl19"
}
```

**Page 2:**
```json
{
  "issues": [
    {"key": "AIS360-122"},
    {"key": "AIS360-121"},
    {"key": "AIS360-120"}
  ],
  "cursor": "eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTIwIl19"
}
```

### Success Criteria
- ✅ First page returns cursor token
- ✅ Second page returns different issues
- ✅ Cursor progresses through result set
- ✅ Final page returns cursor = null

## Test Scenario 4: Field Selection

### Test Description
Validate that field selection works correctly and only requested fields are returned.

### Test Steps
1. **Execute**: Request with specific fields
2. **Validate**: Response contains only requested fields
3. **Compare**: Against full field response

### Test Command
```bash
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "maxResults": 1,
    "fields": ["id", "key", "summary", "status"]
  }
}
```

### Expected Result
```json
{
  "issues": [
    {
      "id": "10001",
      "key": "AIS360-123",
      "self": "https://domain.atlassian.net/rest/api/3/issue/10001",
      "fields": {
        "summary": "Issue summary",
        "status": {"name": "Open", "id": "1"}
      }
    }
  ]
}
```

### Success Criteria
- ✅ Response includes only requested fields
- ✅ Fields are properly structured
- ✅ System fields (id, key, self) always present
- ✅ Unrequested fields absent from response

## Test Scenario 5: Error Handling - Invalid JQL

### Test Description
Validate that invalid JQL queries return clear error messages.

### Test Steps
1. **Execute**: Request with invalid JQL syntax
2. **Validate**: Error response with clear message
3. **Confirm**: No crash or undefined behavior

### Test Command
```bash
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = INVALID AND malformed syntax ORDER BY nonexistent"
  }
}
```

### Expected Result
```json
{
  "error": {
    "errorMessages": [
      "The JQL query is invalid: field 'nonexistent' does not exist or you do not have permission to view it."
    ],
    "errors": {
      "jql": "Invalid JQL syntax"
    },
    "status": 400
  }
}
```

### Success Criteria
- ✅ HTTP 400 status returned
- ✅ Clear error message provided
- ✅ No server crash or timeout
- ✅ Error structure matches expected format

## Test Scenario 6: Backward Compatibility - Legacy Parameters

### Test Description
Validate that legacy parameters (limit, startAt) still work correctly.

### Test Steps
1. **Execute**: Request using legacy parameter names
2. **Validate**: Parameters mapped correctly
3. **Confirm**: Same results as new parameter names

### Test Command
```bash
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "limit": 5,
    "startAt": 0
  }
}
```

### Expected Result
```json
{
  "issues": [...],
  "total": 10,
  "cursor": "eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTE5Il19",
  "maxResults": 5,
  "startAt": 0
}
```

### Success Criteria
- ✅ Legacy `limit` parameter works
- ✅ Legacy `startAt` parameter works  
- ✅ Response includes backward-compatible fields
- ✅ Cursor-based pagination still available

## Test Scenario 7: Rate Limit Handling

### Test Description
Validate proper handling of rate limiting from Jira API.

### Test Steps
1. **Setup**: Trigger rate limit (multiple rapid requests)
2. **Validate**: 429 status handling
3. **Confirm**: Retry-After header respected

### Test Command
```bash
# Execute multiple rapid requests to trigger rate limit
for i in {1..10}; do
  {
    "tool": "search-issues",
    "arguments": {
      "jql": "project = AIS360",
      "maxResults": 1
    }
  }
done
```

### Expected Behavior
- First few requests succeed normally
- Rate limit triggered returns 429
- Retry-After header included in metadata
- Exponential backoff implemented

### Success Criteria
- ✅ 429 status code handled gracefully
- ✅ Rate limit metadata included in response
- ✅ No crashes or undefined behavior
- ✅ Automatic retry logic functions

## Integration Test Summary

### Execution Order
1. Run Test Scenario 1 (Simple Query)
2. Run Test Scenario 2 (Complex Query) 
3. Run Test Scenario 3 (Pagination)
4. Run Test Scenario 4 (Field Selection)
5. Run Test Scenario 5 (Error Handling)
6. Run Test Scenario 6 (Backward Compatibility)
7. Run Test Scenario 7 (Rate Limiting)

### Success Criteria Summary
All test scenarios must pass with the following overall criteria:
- ✅ Zero breaking changes to existing MCP tool interface
- ✅ Enhanced JQL API endpoints used correctly
- ✅ Cursor-based pagination functional
- ✅ Automatic HTTP method selection working
- ✅ Error handling preserves Jira error structure
- ✅ Performance within acceptable limits (<2s for simple queries)
- ✅ Backward compatibility maintained for legacy parameters

### Smoke Test Command
```bash
# Single command to validate basic functionality
{
  "tool": "search-issues",
  "arguments": {
    "jql": "project = AIS360 ORDER BY created DESC",
    "maxResults": 1
  }
}
```

**Expected**: Returns 1 issue from AIS360 project without errors.