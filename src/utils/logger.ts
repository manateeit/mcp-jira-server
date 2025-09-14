type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Structured logging interfaces for Enhanced JQL API operations
export interface SearchOperationLog {
  operationId: string;
  operationType: 'search' | 'paginate' | 'cursor-navigation';
  jql?: string;
  jqlLength?: number;
  maxResults?: number;
  cursor?: string;
  httpMethod?: 'GET' | 'POST';
  timestamp: number;
  userId?: string;
  projectKey?: string;
  domain?: string;
}

export interface ApiInteractionLog {
  operationId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  statusCode?: number;
  requestSize?: number;
  responseSize?: number;
  duration?: number;
  success: boolean;
  error?: string;
  timestamp: number;
  headers?: Record<string, string>;
  userAgent?: string;
}

export interface SearchResultLog {
  operationId: string;
  issueCount: number;
  total?: number;
  hasCursor: boolean;
  cursorToken?: string;
  responseTime: number;
  processingTime?: number;
  cacheHit?: boolean;
  warnings?: string[];
  fieldSelection?: string[];
  expandFields?: string[];
}

export interface ErrorLog {
  operationId: string;
  errorType: 'jql-syntax' | 'authentication' | 'permission' | 'rate-limit' | 'network' | 'validation' | 'unknown';
  message: string;
  jqlQuery?: string;
  statusCode?: number;
  retryable: boolean;
  userGuidance?: string;
  timestamp: number;
}

class Logger {
  private context: string;
  private enabled: boolean;

  constructor(context: string) {
    this.context = context;
    this.enabled = process.env.DEBUG === '*' || (process.env.DEBUG?.includes('jira-mcp') ?? false);
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.enabled && level !== 'error') {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    console.error(`${prefix} ${message}`);
    if (data) {
      console.error(JSON.stringify(data, null, 2));
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, errorData?: any) {
    const data =
      errorData instanceof Error
        ? {
          errorMessage: errorData.message,
          stack: errorData.stack,
          name: errorData.name,
        }
        : errorData;

    this.log('error', message, data);
  }

  // Structured logging methods for Enhanced JQL API operations
  
  /**
   * Log search operation initiation with structured data
   */
  logSearchOperation(data: SearchOperationLog): void {
    const sanitizedData = {
      ...data,
      jql: data.jql ? this.sanitizeJql(data.jql) : undefined,
      cursor: data.cursor ? this.sanitizeCursor(data.cursor) : undefined,
    };
    
    this.log('info', `Search operation started: ${data.operationType}`, {
      type: 'search-operation',
      ...sanitizedData,
    });
  }

  /**
   * Log API interaction with structured data
   */
  logApiInteraction(data: ApiInteractionLog): void {
    const logLevel: LogLevel = data.success ? 'debug' : 'warn';
    const message = `API ${data.method} ${data.endpoint}: ${data.statusCode || 'unknown'} (${data.duration}ms)`;
    
    this.log(logLevel, message, {
      type: 'api-interaction',
      ...data,
      headers: data.headers ? this.sanitizeHeaders(data.headers) : undefined,
    });
  }

  /**
   * Log search results with structured data
   */
  logSearchResult(data: SearchResultLog): void {
    const message = `Search completed: ${data.issueCount} issues${data.total ? ` of ${data.total}` : ''} (${data.responseTime}ms)`;
    
    this.log('info', message, {
      type: 'search-result',
      ...data,
      cursorToken: data.cursorToken ? this.sanitizeCursor(data.cursorToken) : undefined,
    });
  }

  /**
   * Log structured errors with user guidance
   */
  logStructuredError(data: ErrorLog): void {
    const message = `${data.errorType.toUpperCase()}: ${data.message}`;
    
    this.log('error', message, {
      type: 'structured-error',
      ...data,
      jqlQuery: data.jqlQuery ? this.sanitizeJql(data.jqlQuery) : undefined,
    });
  }

  /**
   * Log pagination navigation events
   */
  logPaginationEvent(data: {
    operationId: string;
    event: 'first-page' | 'next-page' | 'final-page' | 'cursor-expired';
    pageNumber?: number;
    totalPages?: number;
    cursor?: string;
    timestamp: number;
  }): void {
    const message = `Pagination: ${data.event}${data.pageNumber ? ` (page ${data.pageNumber}${data.totalPages ? ` of ${data.totalPages}` : ''})` : ''}`;
    
    this.log('debug', message, {
      type: 'pagination-event',
      ...data,
      cursor: data.cursor ? this.sanitizeCursor(data.cursor) : undefined,
    });
  }

  /**
   * Log performance metrics for search operations
   */
  logPerformanceMetrics(data: {
    operationId: string;
    phase: 'validation' | 'http-request' | 'response-processing' | 'formatting';
    duration: number;
    memoryUsage?: number;
    cacheHit?: boolean;
    optimizations?: string[];
  }): void {
    this.log('debug', `Performance: ${data.phase} completed in ${data.duration}ms`, {
      type: 'performance-metrics',
      ...data,
    });
  }

  // Private helper methods for data sanitization

  /**
   * Sanitize JQL query for logging (remove sensitive data, truncate length)
   */
  private sanitizeJql(jql: string): string {
    let sanitized = jql;
    
    // Remove potential sensitive information patterns
    sanitized = sanitized.replace(/email\s*[=~]\s*["'][^"']*["']/gi, 'email = "[REDACTED]"');
    sanitized = sanitized.replace(/assignee\s*[=~]\s*["'][^"']*@[^"']*["']/gi, 'assignee = "[EMAIL_REDACTED]"');
    
    // Truncate very long queries
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...[TRUNCATED]';
    }
    
    return sanitized;
  }

  /**
   * Sanitize cursor token for logging (show only prefix)
   */
  private sanitizeCursor(cursor: string): string {
    if (cursor.length <= 20) {
      return cursor;
    }
    return cursor.substring(0, 20) + '...[CURSOR]';
  }

  /**
   * Sanitize HTTP headers for logging (remove auth tokens)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    if (sanitized.authorization) {
      sanitized.authorization = '[REDACTED]';
    }
    if (sanitized.cookie) {
      sanitized.cookie = '[REDACTED]';
    }
    if (sanitized['x-api-key']) {
      sanitized['x-api-key'] = '[REDACTED]';
    }
    
    return sanitized;
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
