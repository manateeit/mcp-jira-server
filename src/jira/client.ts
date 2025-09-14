/**
 * Enhanced JQL API HTTP Client
 * 
 * This module implements the HTTP client for Jira Enhanced JQL API
 * (/rest/api/3/search/jql) with automatic method selection, cursor-based
 * pagination, and backward compatibility support.
 * 
 * Following TDD: This implementation MUST make contract tests pass
 */

import {
  JiraClientConfig,
  SearchRequest,
  SearchResponse,
  HttpRequestParams,
  HttpResponse,
  JiraApiError,
  EnhancedJiraError,
  ResponseTiming,
  RateLimitInfo,
  ResponseMetadata,
  MAX_GET_QUERY_LENGTH,
  DEFAULT_MAX_RESULTS,
  MAX_RESULTS_LIMIT,
  DEFAULT_TIMEOUT,
  ENHANCED_JQL_PATH,
  isSearchRequest,
  isJiraApiError,
} from './types.js';
import { createLogger } from '../utils/logger.js';

/**
 * Enhanced JQL API HTTP client with intelligent method selection
 * and comprehensive error handling.
 */
export class EnhancedJqlClient {
  private readonly config: Required<JiraClientConfig>;
  private readonly baseUrl: string;
  private readonly logger = createLogger('EnhancedJqlClient');

  constructor(config: JiraClientConfig) {
    // Validate required configuration
    if (!config.domain) {
      throw new Error('Domain is required for Jira client configuration');
    }
    if (!config.email) {
      throw new Error('Email is required for Jira client configuration');
    }
    if (!config.apiToken) {
      throw new Error('API token is required for Jira client configuration');
    }

    // Set defaults for optional configuration
    this.config = {
      ...config,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      userAgent: config.userAgent ?? 'MCP-Jira-Server/1.0.0',
      enableLogging: config.enableLogging ?? false,
    };

    // Construct base URL for Jira Cloud instance
    this.baseUrl = `https://${this.config.domain}.atlassian.net/rest/api/3`;
  }

  /**
   * Execute a search request using the Enhanced JQL API.
   * Automatically selects HTTP method based on query complexity.
   * 
   * @param request - Search parameters including JQL query and options
   * @returns Promise resolving to search results with metadata
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    // Validate request parameters
    if (!isSearchRequest(request)) {
      throw new Error('Invalid search request parameters');
    }

    // Validate maxResults range
    this.validateMaxResults(request.maxResults);

    const startTime = Date.now();
    const operationId = this.generateOperationId();

    // Log search operation initiation with structured data
    this.logger.logSearchOperation({
      operationId,
      operationType: request.cursor ? 'cursor-navigation' : 'search',
      jql: request.jql,
      jqlLength: request.jql.length,
      maxResults: request.maxResults,
      cursor: request.cursor || undefined,
      timestamp: startTime,
      domain: this.config.domain,
    });

    try {
      // Determine HTTP method based on query complexity and user preference
      const httpMethod = this.selectHttpMethod(request);
      
      // Log HTTP method selection
      this.logger.logPerformanceMetrics({
        operationId,
        phase: 'validation',
        duration: Date.now() - startTime,
      });
      
      // Build HTTP request parameters
      const httpParams = this.buildHttpRequest(request, httpMethod);
      
      // Log request if enabled
      if (this.config.enableLogging) {
        console.log(`[${operationId}] Enhanced JQL ${httpMethod} request:`, {
          url: httpParams.url,
          jql: request.jql.substring(0, 100) + (request.jql.length > 100 ? '...' : ''),
          maxResults: request.maxResults,
          cursor: request.cursor,
        });
      }

      // Execute HTTP request
      const httpRequestStartTime = Date.now();
      const httpResponse = await this.executeRequest(httpParams);
      
      // Log API interaction
      this.logger.logApiInteraction({
        operationId,
        endpoint: ENHANCED_JQL_PATH,
        method: httpMethod,
        statusCode: httpResponse.status,
        requestSize: httpParams.body ? httpParams.body.length : 0,
        responseSize: httpResponse.size,
        duration: httpResponse.duration,
        success: httpResponse.status >= 200 && httpResponse.status < 300,
        timestamp: httpRequestStartTime,
        userAgent: this.config.userAgent,
      });
      
      // Log performance metrics for HTTP request phase
      this.logger.logPerformanceMetrics({
        operationId,
        phase: 'http-request',
        duration: httpResponse.duration,
      });
      
      // Process and normalize response
      const processingStartTime = Date.now();
      const searchResponse = this.processResponse(httpResponse, request, startTime, httpMethod);
      
      // Log performance metrics for response processing
      this.logger.logPerformanceMetrics({
        operationId,
        phase: 'response-processing',
        duration: Date.now() - processingStartTime,
      });
      
      // Log search results with structured data
      this.logger.logSearchResult({
        operationId,
        issueCount: searchResponse.issues.length,
        total: searchResponse.total,
        hasCursor: searchResponse.cursor !== null,
        cursorToken: searchResponse.cursor || undefined,
        responseTime: searchResponse.meta.timing.duration,
        processingTime: Date.now() - processingStartTime,
        warnings: searchResponse.meta.warnings,
        fieldSelection: Array.isArray(request.fields) ? request.fields : undefined,
        expandFields: request.expand,
      });

      // Log pagination event if applicable
      if (searchResponse.cursor !== null) {
        this.logger.logPaginationEvent({
          operationId,
          event: request.cursor ? 'next-page' : 'first-page',
          cursor: searchResponse.cursor,
          timestamp: Date.now(),
        });
      } else if (request.cursor) {
        this.logger.logPaginationEvent({
          operationId,
          event: 'final-page',
          timestamp: Date.now(),
        });
      }

      return searchResponse;

    } catch (error) {
      // Handle and enrich errors with context
      const enhancedError = this.enhanceError(error, request, startTime, operationId);
      
      // Log structured error with classification and guidance
      this.logger.logStructuredError({
        operationId,
        errorType: this.classifyError(error),
        message: enhancedError.errorMessages?.[0] || (error instanceof Error ? error.message : String(error)) || 'Unknown error occurred',
        jqlQuery: request.jql,
        statusCode: enhancedError.status,
        retryable: this.isRetryableError(error),
        userGuidance: this.generateUserGuidance(error),
        timestamp: Date.now(),
      });
      
      throw enhancedError;
    }
  }

  /**
   * Determine the optimal HTTP method for the request.
   * Uses user preference or automatic selection based on query complexity.
   */
  private selectHttpMethod(request: SearchRequest): 'GET' | 'POST' {
    // Honor explicit method selection
    if (request.method === 'GET' || request.method === 'POST') {
      return request.method;
    }

    // Automatic selection based on query complexity
    // POST for complex queries (>1500 chars), GET for simple queries
    return request.jql.length > MAX_GET_QUERY_LENGTH ? 'POST' : 'GET';
  }

  /**
   * Build HTTP request parameters for the Enhanced JQL API call.
   */
  private buildHttpRequest(request: SearchRequest, method: 'GET' | 'POST'): HttpRequestParams {
    const url = `${this.baseUrl}${ENHANCED_JQL_PATH}`;
    
    // Common headers for both GET and POST
    const headers: Record<string, string> = {
      'Authorization': `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'User-Agent': this.config.userAgent,
    };

    if (method === 'GET') {
      // Build query parameters for GET request
      const params = this.buildQueryParams(request);
      return {
        method: 'GET',
        url,
        headers,
        params,
        timeout: this.config.timeout,
      };
    } else {
      // Build request body for POST request
      const body = this.buildRequestBody(request);
      headers['Content-Type'] = 'application/json';
      
      return {
        method: 'POST',
        url,
        headers,
        body: JSON.stringify(body),
        timeout: this.config.timeout,
      };
    }
  }

  /**
   * Build query parameters for GET requests.
   * Handles URL encoding and parameter formatting.
   */
  private buildQueryParams(request: SearchRequest): Record<string, string> {
    const params: Record<string, string> = {
      jql: encodeURIComponent(request.jql),
    };

    // Add optional parameters
    if (request.maxResults !== undefined) {
      params.maxResults = request.maxResults.toString();
    }

    if (request.fields !== undefined) {
      params.fields = Array.isArray(request.fields) 
        ? request.fields.join(',')
        : request.fields;
    }

    if (request.expand && request.expand.length > 0) {
      params.expand = request.expand.join(',');
    }

    if (request.cursor) {
      params.cursor = request.cursor;
    }

    return params;
  }

  /**
   * Build request body for POST requests.
   * Preserves array format for fields and expand parameters.
   */
  private buildRequestBody(request: SearchRequest): Record<string, any> {
    const body: Record<string, any> = {
      jql: request.jql,
    };

    // Add optional parameters maintaining proper types
    if (request.maxResults !== undefined) {
      body.maxResults = request.maxResults;
    }

    if (request.fields !== undefined) {
      body.fields = request.fields;
    }

    if (request.expand && request.expand.length > 0) {
      body.expand = request.expand;
    }

    if (request.cursor) {
      body.cursor = request.cursor;
    }

    return body;
  }

  /**
   * Execute HTTP request using native Node.js fetch API.
   */
  private async executeRequest(params: HttpRequestParams): Promise<HttpResponse> {
    const startTime = Date.now();
    
    // Build fetch options
    const fetchOptions: RequestInit = {
      method: params.method,
      headers: params.headers,
      signal: AbortSignal.timeout(params.timeout || DEFAULT_TIMEOUT),
    };

    // Add body for POST requests
    if (params.body) {
      fetchOptions.body = params.body;
    }

    // Build URL with query parameters for GET requests
    let requestUrl = params.url;
    if (params.params && Object.keys(params.params).length > 0) {
      const searchParams = new URLSearchParams(params.params);
      requestUrl = `${params.url}?${searchParams.toString()}`;
    }

    try {
      const response = await fetch(requestUrl, fetchOptions);
      const responseText = await response.text();
      const duration = Date.now() - startTime;

      // Parse response data
      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
      }

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data,
        status: response.status,
        headers: responseHeaders,
        duration,
        size: responseText.length,
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${params.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Process and normalize the HTTP response into Enhanced JQL format.
   */
  private processResponse(
    httpResponse: HttpResponse,
    request: SearchRequest,
    startTime: number,
    httpMethod: 'GET' | 'POST',
  ): SearchResponse {
    // Handle error responses
    if (httpResponse.status >= 400) {
      const errorData = httpResponse.data;
      const jiraError: JiraApiError = {
        errorMessages: errorData.errorMessages || ['Unknown error occurred'],
        errors: errorData.errors || {},
        status: httpResponse.status,
        warningMessages: errorData.warningMessages,
      };
      throw jiraError;
    }

    // Extract response data
    const { issues = [], total, cursor } = httpResponse.data;
    
    // Build timing information
    const timing: ResponseTiming = {
      requestTime: startTime,
      responseTime: Date.now(),
      duration: httpResponse.duration,
    };

    // Extract rate limit information if present
    let rateLimit: RateLimitInfo | undefined;
    if (httpResponse.headers['x-ratelimit-remaining']) {
      rateLimit = {
        remaining: parseInt(httpResponse.headers['x-ratelimit-remaining'], 10),
        resetTime: parseInt(httpResponse.headers['x-ratelimit-reset'], 10),
        retryAfter: httpResponse.headers['retry-after'] 
          ? parseInt(httpResponse.headers['retry-after'], 10)
          : undefined,
      };
    }

    // Build response metadata
    const meta: ResponseMetadata = {
      timing,
      rateLimit,
      httpMethod,
      requestId: httpResponse.headers['x-request-id'] || this.generateOperationId(),
      warnings: httpResponse.data.warningMessages,
    };

    // Build core response
    const response: SearchResponse = {
      issues,
      total,
      cursor: cursor || undefined,
      meta,
    };

    // Add backward compatibility fields if legacy parameters were used
    if (request.limit !== undefined || request.startAt !== undefined) {
      response.maxResults = request.limit || request.maxResults || DEFAULT_MAX_RESULTS;
      response.startAt = request.startAt || 0;
    }

    return response;
  }

  /**
   * Enhance errors with additional context and debugging information.
   */
  private enhanceError(
    error: any,
    request: SearchRequest,
    startTime: number,
    operationId: string,
  ): EnhancedJiraError {
    // If already a Jira API error, enhance it
    if (isJiraApiError(error)) {
      const enhancedError: EnhancedJiraError = {
        ...error,
        originalRequest: request,
        timestamp: startTime,
        requestId: operationId,
        httpMethod: this.selectHttpMethod(request),
      };
      return enhancedError;
    }

    // Convert generic errors to Enhanced Jira Error format
    const enhancedError: EnhancedJiraError = {
      errorMessages: [error.message || 'Unknown error occurred'],
      errors: {},
      status: 500,
      originalRequest: request,
      timestamp: startTime,
      requestId: operationId,
      httpMethod: this.selectHttpMethod(request),
    };

    return enhancedError;
  }

  /**
   * Generate a unique operation ID for request tracking.
   */
  private generateOperationId(): string {
    return `ejql_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate that maxResults is within acceptable range.
   */
  private validateMaxResults(maxResults?: number): void {
    if (maxResults !== undefined) {
      if (maxResults < 1 || maxResults > MAX_RESULTS_LIMIT) {
        throw new Error(`maxResults must be between 1 and ${MAX_RESULTS_LIMIT}, got ${maxResults}`);
      }
    }
  }

  /**
   * Get the base URL for this client instance.
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the client configuration (excluding sensitive data).
   */
  public getConfig(): Omit<JiraClientConfig, 'apiToken'> {
    const { apiToken: _apiToken, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Classify error type for structured logging
   */
  private classifyError(error: any): 'jql-syntax' | 'authentication' | 'permission' | 'rate-limit' | 'network' | 'validation' | 'unknown' {
    if (isJiraApiError(error)) {
      switch (error.status) {
        case 400:
          if (error.errorMessages?.some(msg => msg.toLowerCase().includes('jql'))) {
            return 'jql-syntax';
          }
          return 'validation';
        case 401:
          return 'authentication';
        case 403:
          return 'permission';
        case 429:
          return 'rate-limit';
        default:
          return 'unknown';
      }
    }
    
    if (error.name === 'AbortError') {
      return 'network';
    }
    
    if (error.message?.includes('timeout')) {
      return 'network';
    }
    
    return 'unknown';
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (isJiraApiError(error)) {
      // Rate limit errors are retryable
      if (error.status === 429) {
        return true;
      }
      // Server errors are retryable
      if (error.status >= 500) {
        return true;
      }
    }
    
    // Network timeouts are retryable
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate user guidance for common errors
   */
  private generateUserGuidance(error: any): string {
    if (isJiraApiError(error)) {
      switch (error.status) {
        case 400:
          if (error.errorMessages?.some(msg => msg.toLowerCase().includes('jql'))) {
            return 'Check your JQL query syntax. Common issues: invalid field names, incorrect operators, or missing quotes around values.';
          }
          return 'Verify your request parameters are valid and properly formatted.';
        case 401:
          return 'Check your API credentials. Ensure your email and API token are correct and active.';
        case 403:
          return 'Verify you have permission to access the requested Jira project or issues. Contact your Jira administrator if needed.';
        case 429:
          return 'Rate limit exceeded. Wait before retrying or reduce request frequency.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Jira server error. Try again in a few minutes or contact support if the issue persists.';
        default:
          return 'Unexpected error occurred. Review the error details and try again.';
      }
    }
    
    if (error.name === 'AbortError') {
      return 'Request timed out. Try reducing query complexity or increasing timeout settings.';
    }
    
    return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }
}

/**
 * Factory function to create a new Enhanced JQL client with validation.
 */
export function createEnhancedJqlClient(config: JiraClientConfig): EnhancedJqlClient {
  return new EnhancedJqlClient(config);
}

/**
 * Utility function to determine if a query should use POST method.
 */
export function shouldUsePostMethod(jql: string): boolean {
  return jql.length > MAX_GET_QUERY_LENGTH;
}

/**
 * Utility function to encode JQL query for URL usage.
 */
export function encodeJqlForUrl(jql: string): string {
  return encodeURIComponent(jql);
}