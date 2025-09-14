/**
 * Enhanced JQL API Service Layer
 * 
 * This module provides a high-level service interface for Jira Enhanced JQL API
 * operations. It orchestrates the HTTP client, handles parameter mapping for
 * backward compatibility, and provides the search functionality consumed by MCP tools.
 * 
 * Following TDD: This implementation MUST make integration tests pass
 */

import {
  JiraClientConfig,
  SearchRequest,
  SearchResponse,
  LegacySearchRequest,
  LegacySearchResponse,
  JiraIssue,
  SearchMetrics,
  DEFAULT_MAX_RESULTS,
  MAX_RESULTS_LIMIT,
  MAX_JQL_LENGTH,
  MAX_GET_QUERY_LENGTH,
  MAX_METRICS_ENTRIES,
  isSearchRequest,
} from './types.js';
import { EnhancedJqlClient } from './client.js';
import { createLogger } from '../utils/logger.js';

/**
 * Configuration for the Enhanced JQL service.
 */
export interface JiraServiceConfig extends JiraClientConfig {
  /** Enable automatic parameter mapping for legacy requests */
  enableLegacySupport?: boolean;
  /** Default maximum results when not specified */
  defaultMaxResults?: number;
  /** Enable performance metrics collection */
  enableMetrics?: boolean;
}

/**
 * Enhanced JQL service providing high-level search operations
 * with backward compatibility and parameter mapping.
 */
export class EnhancedJqlService {
  private readonly client: EnhancedJqlClient;
  private readonly config: Required<JiraServiceConfig>;
  private readonly metrics: Map<string, SearchMetrics> = new Map();
  private readonly logger = createLogger('EnhancedJqlService');

  constructor(config: JiraServiceConfig) {
    // Set service-specific defaults
    this.config = {
      ...config,
      enableLegacySupport: config.enableLegacySupport ?? true,
      defaultMaxResults: config.defaultMaxResults ?? DEFAULT_MAX_RESULTS,
      enableMetrics: config.enableMetrics ?? false,
      timeout: config.timeout ?? 30000,
      userAgent: config.userAgent ?? 'MCP-Jira-Server/1.0.0',
      enableLogging: config.enableLogging ?? false,
    };

    // Initialize HTTP client
    this.client = new EnhancedJqlClient(this.config);
  }

  /**
   * Search Jira issues using Enhanced JQL API with modern interface.
   * Supports cursor-based pagination and all Enhanced JQL features.
   * 
   * @param request - Modern search request with Enhanced JQL parameters
   * @returns Promise resolving to search results with metadata
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    const operationId = this.generateOperationId();

    try {
      // Validate and normalize the request
      const normalizedRequest = this.normalizeSearchRequest(request);
      
      // Log search operation initiation with structured data
      this.logger.logSearchOperation({
        operationId,
        operationType: normalizedRequest.cursor ? 'cursor-navigation' : 'search',
        jql: normalizedRequest.jql,
        jqlLength: normalizedRequest.jql.length,
        maxResults: normalizedRequest.maxResults,
        cursor: normalizedRequest.cursor || undefined,
        httpMethod: normalizedRequest.method === 'auto' ? undefined : normalizedRequest.method,
        timestamp: startTime,
        domain: this.config.domain ? new URL(`https://${this.config.domain}.atlassian.net`).hostname.replace('.atlassian.net', '') : undefined,
      });
      
      // Execute search via HTTP client
      const response = await this.client.search(normalizedRequest);
      
      // Log search results with structured data
      this.logger.logSearchResult({
        operationId,
        issueCount: response.issues.length,
        total: response.total,
        hasCursor: response.cursor !== null && response.cursor !== undefined,
        cursorToken: response.cursor || undefined,
        responseTime: response.meta.timing.duration,
        processingTime: Date.now() - startTime,
        cacheHit: false, // Could be enhanced to track caching
        warnings: response.meta.warnings,
        fieldSelection: typeof normalizedRequest.fields === 'string' ? [normalizedRequest.fields] : normalizedRequest.fields,
        expandFields: normalizedRequest.expand,
      });
      
      // Collect metrics if enabled
      if (this.config.enableMetrics) {
        this.collectSearchMetrics(operationId, normalizedRequest, response, startTime);
      }

      return response;

    } catch (error) {
      // Log structured error
      this.logger.logStructuredError({
        operationId,
        errorType: this.classifyError(error),
        message: error instanceof Error ? error.message : String(error),
        jqlQuery: request.jql,
        statusCode: this.extractStatusCode(error),
        retryable: this.isRetryableError(error),
        userGuidance: this.generateUserGuidance(error),
        timestamp: Date.now(),
      });
      
      throw error;
    }
  }

  /**
   * Search Jira issues with backward compatibility for legacy parameters.
   * Maps legacy parameters (limit, startAt) to Enhanced JQL format.
   * 
   * @param request - Legacy or modern search request
   * @returns Promise resolving to search results with legacy compatibility
   */
  async searchWithLegacySupport(request: LegacySearchRequest): Promise<LegacySearchResponse> {
    if (!this.config.enableLegacySupport) {
      throw new Error('Legacy support is disabled for this service instance');
    }

    const operationId = this.generateOperationId();

    try {
      // Map legacy parameters to modern format
      const modernRequest = this.mapLegacyRequest(request);
      
      // Log legacy parameter mapping
      this.logger.info('Legacy parameter mapping', {
        operationId,
        hadLegacyParams: !!(request.limit || request.startAt),
        limit: request.limit,
        startAt: request.startAt,
        mappedToMaxResults: modernRequest.maxResults,
        deprecationWarning: request.startAt !== undefined && request.cursor === undefined,
      });
      
      // Execute modern search
      const modernResponse = await this.search(modernRequest);
      
      // Map response back to legacy format
      const legacyResponse = this.mapToLegacyResponse(modernResponse, request);

      return legacyResponse;

    } catch (error) {
      // Error logging is handled by the search() method
      throw error;
    }
  }

  /**
   * Get paginated results using cursor-based navigation.
   * Continues from a previous search using the cursor token.
   * 
   * @param jql - JQL query expression
   * @param cursor - Cursor token from previous response
   * @param maxResults - Maximum results per page
   * @returns Promise resolving to next page of results
   */
  async getNextPage(jql: string, cursor: string, maxResults?: number): Promise<SearchResponse> {
    const request: SearchRequest = {
      jql,
      cursor,
      maxResults: maxResults || this.config.defaultMaxResults,
    };

    return this.search(request);
  }

  /**
   * Get all results by automatically paginating through cursor-based responses.
   * WARNING: Use with caution for large result sets.
   * 
   * @param jql - JQL query expression
   * @param maxResults - Maximum results per page (not total)
   * @param maxPages - Maximum number of pages to retrieve (safety limit)
   * @returns Promise resolving to all issues across all pages
   */
  async getAllResults(
    jql: string, 
    maxResults: number = this.config.defaultMaxResults,
    maxPages: number = 10,
  ): Promise<{ issues: JiraIssue[]; totalPages: number; finalCursor: string | null }> {
    const allIssues: JiraIssue[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      if (pageCount >= maxPages) {
        throw new Error(`Maximum page limit (${maxPages}) exceeded for query: ${jql.substring(0, 100)}...`);
      }

      const response = await this.search({
        jql,
        cursor,
        maxResults,
      });

      allIssues.push(...response.issues);
      cursor = response.cursor;
      pageCount++;

      // Log pagination progress with structured data
      this.logger.logPaginationEvent({
        operationId: this.generateOperationId(),
        event: pageCount === 1 ? 'first-page' : cursor ? 'next-page' : 'final-page',
        pageNumber: pageCount,
        cursor: cursor || undefined,
        timestamp: Date.now(),
      });

    } while (cursor !== null);

    return {
      issues: allIssues,
      totalPages: pageCount,
      finalCursor: cursor,
    };
  }

  /**
   * Get service configuration (excluding sensitive data).
   */
  public getConfig(): Omit<JiraServiceConfig, 'apiToken'> {
    const { apiToken: _apiToken, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Get collected search metrics if enabled.
   */
  public getMetrics(): Map<string, SearchMetrics> {
    if (!this.config.enableMetrics) {
      throw new Error('Metrics collection is disabled for this service instance');
    }
    return new Map(this.metrics);
  }

  /**
   * Clear collected metrics.
   */
  public clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Normalize search request parameters and apply defaults.
   */
  private normalizeSearchRequest(request: SearchRequest): SearchRequest {
    // Apply defaults first
    const normalized: SearchRequest = {
      ...request,
      maxResults: request.maxResults ?? this.config.defaultMaxResults,
    };

    // Validate maxResults is within limits
    if (normalized.maxResults! > MAX_RESULTS_LIMIT) {
      throw new Error(`maxResults cannot exceed ${MAX_RESULTS_LIMIT}, got ${normalized.maxResults}`);
    }

    // Validate basic request structure after normalization
    if (!isSearchRequest(normalized)) {
      throw new Error('Invalid search request parameters');
    }

    return normalized;
  }

  /**
   * Map legacy request parameters to modern Enhanced JQL format.
   */
  private mapLegacyRequest(request: LegacySearchRequest): SearchRequest {
    const modernRequest: SearchRequest = {
      jql: request.jql,
      maxResults: request.limit ?? request.maxResults ?? this.config.defaultMaxResults,
      fields: request.fields,
      expand: request.expand,
      cursor: request.cursor,
      method: request.method,
    };

    // Handle startAt pagination by ignoring it (cursor-based pagination takes precedence)
    if (request.startAt !== undefined && request.cursor === undefined) {
      // Log warning about startAt deprecation
      this.logger.warn('startAt parameter is deprecated, use cursor-based pagination instead', {
        startAt: request.startAt,
        jql: request.jql.substring(0, 100),
        suggestion: 'Use cursor parameter from previous response for pagination',
      });
    }

    return modernRequest;
  }

  /**
   * Map modern response to legacy response format for backward compatibility.
   */
  private mapToLegacyResponse(response: SearchResponse, originalRequest: LegacySearchRequest): LegacySearchResponse {
    const legacyResponse: LegacySearchResponse = {
      issues: response.issues,
      total: response.total,
      cursor: response.cursor,
      meta: response.meta,
    };

    // Add legacy fields if original request used legacy parameters
    if (originalRequest.limit !== undefined || originalRequest.startAt !== undefined) {
      legacyResponse.maxResults = originalRequest.limit ?? response.meta.timing.duration; // Use timing as placeholder
      legacyResponse.startAt = originalRequest.startAt ?? 0;
    }

    return legacyResponse;
  }

  /**
   * Collect performance metrics for search operations.
   */
  private collectSearchMetrics(
    operationId: string,
    _request: SearchRequest,
    response: SearchResponse,
    startTime: number,
  ): void {
    const metrics: SearchMetrics = {
      totalDuration: Date.now() - startTime,
      requestDuration: response.meta.timing.duration,
      processingDuration: (Date.now() - startTime) - response.meta.timing.duration,
      issueCount: response.issues.length,
      responseSize: JSON.stringify(response).length,
      wasCached: false, // Could be enhanced to track caching
    };

    this.metrics.set(operationId, metrics);

    // Limit metrics storage to prevent memory leaks (LRU-style cleanup)
    if (this.metrics.size > MAX_METRICS_ENTRIES) {
      const firstKey = this.metrics.keys().next().value;
      if (firstKey) {
        this.metrics.delete(firstKey);
      }
    }
  }

  /**
   * Generate a unique operation ID for tracking.
   */
  private generateOperationId(): string {
    return `ejql_service_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Classify error type for structured logging.
   */
  private classifyError(error: unknown): 'jql-syntax' | 'authentication' | 'permission' | 'rate-limit' | 'network' | 'validation' | 'unknown' {
    if (!(error instanceof Error)) {
      return 'unknown';
    }
    
    const message = error.message.toLowerCase();
    
    if (message.includes('syntax') || message.includes('jql')) {
      return 'jql-syntax';
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return 'authentication';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'permission';
    }
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate-limit';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('econnreset')) {
      return 'network';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  /**
   * Extract status code from error for structured logging.
   */
  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      // Check common error object patterns
      if ('status' in error && typeof error.status === 'number') {
        return error.status;
      }
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        return error.statusCode;
      }
      if ('response' in error && error.response && typeof error.response === 'object') {
        const response = error.response as any;
        if ('status' in response && typeof response.status === 'number') {
          return response.status;
        }
      }
    }
    return undefined;
  }

  /**
   * Determine if error is retryable for structured logging.
   */
  private isRetryableError(error: unknown): boolean {
    const statusCode = this.extractStatusCode(error);
    
    // 5xx errors are generally retryable
    if (statusCode && statusCode >= 500) {
      return true;
    }
    
    // Rate limit errors are retryable
    if (statusCode === 429) {
      return true;
    }
    
    // Network errors are retryable
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('timeout') || message.includes('network') || message.includes('econnreset')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate user guidance for error recovery.
   */
  private generateUserGuidance(error: unknown): string | undefined {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'jql-syntax':
        return 'Check JQL query syntax. Common issues: missing quotes, invalid field names, or unsupported operators.';
      case 'authentication':
        return 'Verify API token and email credentials. Ensure token has not expired.';
      case 'permission':
        return 'Check user permissions for the project and fields being accessed.';
      case 'rate-limit':
        return 'Request rate exceeded. Wait before retrying or reduce request frequency.';
      case 'network':
        return 'Network connectivity issue. Check internet connection and try again.';
      case 'validation':
        return 'Request parameters are invalid. Check field names, values, and request format.';
      default:
        return 'An unexpected error occurred. Check logs for more details.';
    }
  }
}

/**
 * Factory function to create a new Enhanced JQL service with validation.
 */
export function createEnhancedJqlService(config: JiraServiceConfig): EnhancedJqlService {
  return new EnhancedJqlService(config);
}

/**
 * Utility function to validate JQL query syntax (basic validation).
 */
export function validateJqlSyntax(jql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Basic JQL validation rules
  if (!jql || jql.trim().length === 0) {
    errors.push('JQL query cannot be empty');
  }
  
  if (jql.length > MAX_JQL_LENGTH) {
    errors.push(`JQL query is too long (>${MAX_JQL_LENGTH.toLocaleString()} characters)`);
  }
  
  // Check for potentially problematic patterns
  if (jql.includes('--') || jql.includes('/*') || jql.includes('*/')) {
    errors.push('JQL query contains potentially unsafe comment syntax');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Utility function to estimate query complexity for method selection.
 */
export function estimateQueryComplexity(jql: string): {
  complexity: 'simple' | 'moderate' | 'complex';
  recommendedMethod: 'GET' | 'POST';
  factors: string[];
} {
  const factors: string[] = [];
  let complexityScore = 0;
  
  // Length factor
  if (jql.length > MAX_GET_QUERY_LENGTH) {
    complexityScore += 4; // Ensure long queries are classified as complex
    factors.push(`Long query (>${MAX_GET_QUERY_LENGTH} chars)`);
  }
  
  // Operator complexity
  const complexOperators = ['IN', 'NOT IN', 'WAS', 'WAS IN', 'WAS NOT', 'CHANGED'];
  complexOperators.forEach(op => {
    if (jql.toUpperCase().includes(op)) {
      complexityScore += 1;
      factors.push(`Complex operator: ${op}`);
    }
  });
  
  // Nested conditions
  const parenCount = (jql.match(/\(/g) || []).length;
  if (parenCount > 2) {
    complexityScore += 2;
    factors.push('Deeply nested conditions');
  }
  
  // Functions
  const functions = ['membersOf', 'currentUser', 'issueHistory'];
  functions.forEach(func => {
    if (jql.includes(func)) {
      complexityScore += 1;
      factors.push(`JQL function: ${func}`);
    }
  });
  
  // Determine complexity and method
  let complexity: 'simple' | 'moderate' | 'complex';
  let recommendedMethod: 'GET' | 'POST';
  
  if (complexityScore <= 1) {
    complexity = 'simple';
    recommendedMethod = 'GET';
  } else if (complexityScore <= 3) {
    complexity = 'moderate';
    recommendedMethod = jql.length > MAX_GET_QUERY_LENGTH ? 'POST' : 'GET';
  } else {
    complexity = 'complex';
    recommendedMethod = 'POST';
  }
  
  return { complexity, recommendedMethod, factors };
}