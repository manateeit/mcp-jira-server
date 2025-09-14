/**
 * TypeScript interfaces for Enhanced JQL API Migration
 *
 * This file contains type definitions for the Jira Enhanced JQL API
 * based on the data model specifications from data-model.md.
 * 
 * All interfaces follow the Enhanced JQL API contract and maintain
 * backward compatibility with existing MCP tool signatures.
 */

// ============================================================================
// Core Entities (from data-model.md)
// ============================================================================

/**
 * Represents a single Jira issue returned by the Enhanced JQL API.
 * 
 * Validation Rules:
 * - `id` must be non-empty string
 * - `key` must match Jira key format pattern
 * - `self` must be valid URL
 */
export interface JiraIssue {
  /** Unique issue identifier */
  id: string;
  
  /** Human-readable issue key (e.g., "AIS360-123") */
  key: string;
  
  /** REST API URL for the issue */
  self: string;
  
  /** Issue field data based on field selection */
  fields: {
    /** Issue summary/title */
    summary?: string;
    
    /** Issue description */
    description?: string;
    
    /** Current status of the issue */
    status?: {
      name: string;
      id: string;
      statusCategory?: {
        id: number;
        key: string;
        colorName: string;
        name: string;
      };
    };
    
    /** User assigned to the issue */
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
      active: boolean;
    };
    
    /** User who reported the issue */
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
      active: boolean;
    };
    
    /** Issue creation timestamp */
    created?: string;
    
    /** Issue last update timestamp */
    updated?: string;
    
    /** Issue due date */
    duedate?: string;
    
    /** Issue priority */
    priority?: {
      id: string;
      name: string;
      iconUrl: string;
    };
    
    /** Issue type */
    issuetype?: {
      id: string;
      name: string;
      description: string;
      iconUrl: string;
      subtask: boolean;
    };
    
    /** Project the issue belongs to */
    project?: {
      id: string;
      key: string;
      name: string;
      projectTypeKey: string;
    };
    
    /** Labels applied to the issue */
    labels?: string[];
    
    /** Components associated with the issue */
    components?: Array<{
      id: string;
      name: string;
      description?: string;
    }>;
    
    /** Fix versions for the issue */
    fixVersions?: Array<{
      id: string;
      name: string;
      description?: string;
      released: boolean;
      releaseDate?: string;
    }>;
    
    /** Affects versions for the issue */
    versions?: Array<{
      id: string;
      name: string;
      description?: string;
      released: boolean;
      releaseDate?: string;
    }>;
    
    /** Issue resolution */
    resolution?: {
      id: string;
      name: string;
      description: string;
    };
    
    /** Issue resolution date */
    resolutiondate?: string;
    
    /** Time tracking information */
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    
    /** Custom fields (dynamic based on Jira configuration) */
    [customField: string]: any;
  };
}

/**
 * Field selection options for Enhanced JQL API requests.
 * Supports array format, special values, or navigable fields.
 */
export type FieldSelection = 
  | string[]           // Array of specific field names
  | '*all'            // Include all available fields
  | '*navigable';     // Include navigable fields only

/**
 * HTTP method selection for Enhanced JQL API requests.
 * - 'auto': Automatic selection based on query complexity (default)
 * - 'GET': Force GET method (suitable for simple queries <1500 chars)
 * - 'POST': Force POST method (suitable for complex queries)
 */
export type HttpMethod = 'auto' | 'GET' | 'POST';

/**
 * Represents the parameters for a Jira issue search operation.
 * 
 * Validation Rules:
 * - `jql` must be non-empty string
 * - `maxResults` must be 1-100
 * - `fields` array items must be valid field names
 * - `cursor` must be valid token format when present
 * 
 * State Transitions:
 * - Initial request: cursor = null
 * - Paginated request: cursor = token from previous response
 * - Final page: cursor = null in response
 */
export interface SearchRequest {
  /** JQL query expression (required) */
  jql: string;
  
  /** Maximum results to return (default: 50, max: 100) */
  maxResults?: number;
  
  /** Fields to include in response */
  fields?: FieldSelection;
  
  /** Additional data to expand */
  expand?: string[];
  
  /** Pagination cursor token */
  cursor?: string | null;
  
  /** HTTP method selection strategy */
  method?: HttpMethod;
  
  // Legacy parameters for backward compatibility (deprecated)
  
  /** @deprecated Use maxResults instead */
  limit?: number;
  
  /** @deprecated Use cursor-based pagination instead */
  startAt?: number;
}

/**
 * Response timing information for performance tracking.
 */
export interface ResponseTiming {
  /** Request timestamp (Unix milliseconds) */
  requestTime: number;
  
  /** Response timestamp (Unix milliseconds) */
  responseTime: number;
  
  /** Request duration in milliseconds */
  duration: number;
}

/**
 * Rate limiting information from Jira API.
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  
  /** Rate limit reset timestamp (Unix seconds) */
  resetTime: number;
  
  /** Seconds to wait if rate limited (present in 429 responses) */
  retryAfter?: number;
}

/**
 * Contains operational metadata for search responses.
 */
export interface ResponseMetadata {
  /** Response timing information */
  timing: ResponseTiming;
  
  /** API warnings or deprecation notices */
  warnings?: string[];
  
  /** Rate limiting information */
  rateLimit?: RateLimitInfo;
  
  /** HTTP method actually used for the request */
  httpMethod?: 'GET' | 'POST';
  
  /** Request identifier for debugging */
  requestId?: string;
}

/**
 * Represents the response from Enhanced JQL API search operation.
 * 
 * Validation Rules:
 * - `issues` must be array (can be empty)
 * - `total` must be non-negative when present
 * - `cursor` must be null for final page
 */
export interface SearchResponse {
  /** Array of matching issues */
  issues: JiraIssue[];
  
  /** Total count (may be undefined for cursor pagination) */
  total?: number;
  
  /** Next page token for pagination (null for final page) */
  cursor: string | null;
  
  /** Operation metadata */
  meta: ResponseMetadata;
  
  // Legacy fields for backward compatibility (deprecated)
  
  /** @deprecated Legacy field for backward compatibility */
  startAt?: number;
  
  /** @deprecated Legacy field for backward compatibility */
  maxResults?: number;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Represents errors returned by Jira Enhanced JQL API.
 * Preserves the standard Jira error format for compatibility.
 */
export interface JiraApiError {
  /** Human-readable error messages */
  errorMessages: string[];
  
  /** Field-specific error details */
  errors?: { [fieldName: string]: string };
  
  /** HTTP status code */
  status: number;
  
  /** Non-fatal warnings */
  warningMessages?: string[];
}

/**
 * Enhanced error with additional context for debugging.
 */
export interface EnhancedJiraError extends JiraApiError {
  /** Original request that caused the error */
  originalRequest?: SearchRequest;
  
  /** Timestamp when error occurred */
  timestamp?: number;
  
  /** Request ID for tracing */
  requestId?: string;
  
  /** HTTP method used */
  httpMethod?: 'GET' | 'POST';
  
  /** Rate limit information if applicable */
  rateLimit?: RateLimitInfo;
}

// ============================================================================
// Backward Compatibility Types
// ============================================================================

/**
 * Legacy parameter mapping for zero-disruption migration.
 * Maps old parameter names to new Enhanced JQL API format.
 */
export interface LegacyParameterMapping {
  /** Maps limit → maxResults */
  limit?: number;
  
  /** Maps startAt → cursor navigation */
  startAt?: number;
}

/**
 * Request with legacy parameters support.
 * Extends SearchRequest with deprecated parameters.
 */
export interface LegacySearchRequest extends SearchRequest, LegacyParameterMapping {}

/**
 * Response with legacy fields support.
 * Extends SearchResponse with deprecated response fields.
 */
export interface LegacySearchResponse extends SearchResponse {
  /** Legacy startAt field */
  startAt?: number;
  
  /** Legacy maxResults field */
  maxResults?: number;
}

// ============================================================================
// HTTP Client Types
// ============================================================================

/**
 * Configuration for Enhanced JQL API HTTP client.
 */
export interface JiraClientConfig {
  /** Jira domain (e.g., 'your-domain' for your-domain.atlassian.net) */
  domain: string;
  
  /** Authentication email */
  email: string;
  
  /** API token for authentication */
  apiToken: string;
  
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** User agent string for requests */
  userAgent?: string;
  
  /** Enable request/response logging */
  enableLogging?: boolean;
}

/**
 * HTTP request parameters for Enhanced JQL API.
 */
export interface HttpRequestParams {
  /** HTTP method to use */
  method: 'GET' | 'POST';
  
  /** Request URL */
  url: string;
  
  /** Request headers */
  headers: Record<string, string>;
  
  /** Query parameters for GET requests */
  params?: Record<string, string>;
  
  /** Request body for POST requests */
  body?: string;
  
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * HTTP response from Enhanced JQL API.
 */
export interface HttpResponse<T = any> {
  /** Response data */
  data: T;
  
  /** HTTP status code */
  status: number;
  
  /** Response headers */
  headers: Record<string, string>;
  
  /** Request duration in milliseconds */
  duration: number;
  
  /** Response size in bytes */
  size?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Pagination state for cursor-based navigation.
 */
export interface PaginationState {
  /** Current cursor token */
  cursor: string | null;
  
  /** Whether there are more pages */
  hasNextPage: boolean;
  
  /** Total items processed so far */
  totalProcessed: number;
  
  /** Current page number (1-indexed) */
  pageNumber: number;
}

/**
 * Search operation context for tracking and debugging.
 */
export interface SearchContext {
  /** Unique identifier for this search operation */
  operationId: string;
  
  /** Original search request */
  request: SearchRequest;
  
  /** Start time of the operation */
  startTime: number;
  
  /** HTTP method selected */
  httpMethod: 'GET' | 'POST';
  
  /** Whether query was considered complex */
  isComplexQuery: boolean;
  
  /** Pagination state */
  pagination: PaginationState;
}

/**
 * Performance metrics for search operations.
 */
export interface SearchMetrics {
  /** Total operation duration */
  totalDuration: number;
  
  /** HTTP request duration */
  requestDuration: number;
  
  /** Response processing duration */
  processingDuration: number;
  
  /** Number of issues returned */
  issueCount: number;
  
  /** Response size in bytes */
  responseSize: number;
  
  /** Whether response was cached */
  wasCached: boolean;
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if an object is a valid JiraIssue.
 */
export function isJiraIssue(obj: any): obj is JiraIssue {
  return obj && 
         typeof obj.id === 'string' && obj.id.length > 0 &&
         typeof obj.key === 'string' && obj.key.length > 0 &&
         typeof obj.self === 'string' && obj.self.length > 0 &&
         typeof obj.fields === 'object' && obj.fields !== null;
}

/**
 * Type guard to check if an object is a valid SearchRequest.
 */
export function isSearchRequest(obj: any): obj is SearchRequest {
  return obj && 
         typeof obj.jql === 'string' && obj.jql.length > 0 &&
         (obj.maxResults === undefined || (typeof obj.maxResults === 'number' && obj.maxResults >= 1 && obj.maxResults <= 100)) &&
         (obj.cursor === undefined || obj.cursor === null || typeof obj.cursor === 'string');
}

/**
 * Type guard to check if an error is a JiraApiError.
 */
export function isJiraApiError(obj: any): obj is JiraApiError {
  return obj && 
         Array.isArray(obj.errorMessages) &&
         typeof obj.status === 'number';
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters in JQL query before switching to POST method */
export const MAX_GET_QUERY_LENGTH = 1500;

/** Default maximum results per page */
export const DEFAULT_MAX_RESULTS = 50;

/** Maximum allowed results per page */
export const MAX_RESULTS_LIMIT = 100;

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT = 30000;

/** Enhanced JQL API base path */
export const ENHANCED_JQL_PATH = '/rest/api/3/search/jql';

/** Supported HTTP methods for Enhanced JQL API */
export const SUPPORTED_HTTP_METHODS = ['GET', 'POST'] as const;

/** Field selection special values */
export const SPECIAL_FIELD_VALUES = ['*all', '*navigable'] as const;
