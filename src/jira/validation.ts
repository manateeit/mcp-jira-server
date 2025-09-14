/**
 * Parameter Validation Utilities for Enhanced JQL API
 * 
 * This module provides comprehensive validation utilities for Enhanced JQL API
 * parameters, including JQL syntax validation, field validation, cursor token
 * validation, and backward compatibility parameter mapping validation.
 * 
 * Following TDD: This implementation MUST support all validation requirements
 */

import {
  SearchRequest,
  LegacySearchRequest,
  FieldSelection,
  HttpMethod,
  MAX_RESULTS_LIMIT,
  SPECIAL_FIELD_VALUES,
} from './types';

/**
 * Validation result interface for all validation operations.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Array of non-fatal warning messages */
  warnings: string[];
}

/**
 * Enhanced validation result with suggestions for improvement.
 */
export interface EnhancedValidationResult extends ValidationResult {
  /** Suggested corrections or improvements */
  suggestions: string[];
  /** Severity level of the validation result */
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * JQL-specific validation result with syntax analysis.
 */
export interface JqlValidationResult extends EnhancedValidationResult {
  /** Estimated query complexity */
  complexity: 'simple' | 'moderate' | 'complex';
  /** Recommended HTTP method */
  recommendedMethod: 'GET' | 'POST';
  /** Detected JQL components */
  components: {
    projects: string[];
    fields: string[];
    operators: string[];
    functions: string[];
  };
}

/**
 * Validation configuration options.
 */
export interface ValidationOptions {
  /** Enable strict validation mode */
  strict?: boolean;
  /** Enable performance warnings */
  performanceWarnings?: boolean;
  /** Enable security checks */
  securityChecks?: boolean;
  /** Maximum allowed JQL length */
  maxJqlLength?: number;
  /** Custom field validation patterns */
  customFieldPatterns?: RegExp[];
}

/**
 * Default validation options.
 */
export const DEFAULT_VALIDATION_OPTIONS: Required<ValidationOptions> = {
  strict: false,
  performanceWarnings: true,
  securityChecks: true,
  maxJqlLength: 8000,
  customFieldPatterns: [/^customfield_\d+$/],
};

/**
 * Comprehensive parameter validation utilities class.
 */
export class ParameterValidator {
  private readonly options: Required<ValidationOptions>;

  constructor(options: ValidationOptions = {}) {
    this.options = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  }

  /**
   * Validate a complete search request with all parameters.
   */
  validateSearchRequest(request: SearchRequest): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate JQL query (required)
    if (!request.jql || request.jql.trim().length === 0) {
      if (!request.jql) {
        errors.push('JQL query is required');
      } else {
        errors.push('JQL query cannot be empty or whitespace only');
      }
    } else {
      const jqlResult = this.validateJql(request.jql);
      errors.push(...jqlResult.errors);
      warnings.push(...jqlResult.warnings);
      suggestions.push(...jqlResult.suggestions);
    }

    // Validate maxResults
    if (request.maxResults !== undefined) {
      const maxResultsResult = this.validateMaxResults(request.maxResults);
      errors.push(...maxResultsResult.errors);
      warnings.push(...maxResultsResult.warnings);
    }

    // Validate fields selection
    if (request.fields !== undefined) {
      const fieldsResult = this.validateFields(request.fields);
      errors.push(...fieldsResult.errors);
      warnings.push(...fieldsResult.warnings);
      suggestions.push(...fieldsResult.suggestions);
    }

    // Validate expand parameters
    if (request.expand !== undefined && request.expand.length > 0) {
      const expandResult = this.validateExpand(request.expand);
      errors.push(...expandResult.errors);
      warnings.push(...expandResult.warnings);
    }

    // Validate cursor token
    if (request.cursor !== undefined && request.cursor !== null) {
      const cursorResult = this.validateCursor(request.cursor);
      errors.push(...cursorResult.errors);
      warnings.push(...cursorResult.warnings);
    }

    // Validate HTTP method
    if (request.method !== undefined) {
      const methodResult = this.validateMethod(request.method);
      errors.push(...methodResult.errors);
      warnings.push(...methodResult.warnings);
    }

    // Determine severity
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';
    if (errors.length > 0) {
      severity = errors.some(e => e.includes('required') || e.includes('critical')) ? 'critical' : 'error';
    } else if (warnings.length > 0) {
      severity = 'warning';
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      severity,
    };
  }

  /**
   * Validate a legacy search request and provide migration guidance.
   */
  validateLegacyRequest(request: LegacySearchRequest): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate core parameters using modern validation
    const modernValidation = this.validateSearchRequest(request);
    errors.push(...modernValidation.errors);
    warnings.push(...modernValidation.warnings.filter(w => !w.includes('deprecated')));

    // Check for legacy parameters and provide migration guidance
    if (request.limit !== undefined) {
      warnings.push('Parameter "limit" is deprecated, use "maxResults" instead');
      suggestions.push('Replace "limit" with "maxResults" for Enhanced JQL API compatibility');
    }

    if (request.startAt !== undefined) {
      warnings.push('Parameter "startAt" is deprecated, use cursor-based pagination instead');
      suggestions.push('Switch to cursor-based pagination using "cursor" parameter for better performance');
    }

    // Validate legacy-specific constraints
    if (request.limit !== undefined && request.limit > MAX_RESULTS_LIMIT) {
      errors.push(`Legacy "limit" parameter cannot exceed ${MAX_RESULTS_LIMIT}`);
    }

    if (request.startAt !== undefined && request.startAt < 0) {
      errors.push('Legacy "startAt" parameter must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }

  /**
   * Comprehensive JQL validation with syntax analysis.
   */
  validateJql(jql: string): JqlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const components = {
      projects: [] as string[],
      fields: [] as string[],
      operators: [] as string[],
      functions: [] as string[],
    };

    // Basic syntax validation
    if (!jql || typeof jql !== 'string') {
      return {
        valid: false,
        errors: ['JQL query must be a non-empty string'],
        warnings: [],
        suggestions: ['Provide a valid JQL query string'],
        severity: 'critical',
        complexity: 'simple',
        recommendedMethod: 'GET',
        components,
      };
    }

    const trimmedJql = jql.trim();
    if (trimmedJql.length === 0) {
      errors.push('JQL query cannot be empty or whitespace only');
    }

    // Length validation
    if (trimmedJql.length > this.options.maxJqlLength) {
      errors.push(`JQL query exceeds maximum length of ${this.options.maxJqlLength} characters`);
    }

    // Security checks
    if (this.options.securityChecks) {
      const securityResult = this.performSecurityChecks(trimmedJql);
      errors.push(...securityResult.errors);
      warnings.push(...securityResult.warnings);
    }

    // Syntax pattern validation
    const syntaxResult = this.validateJqlSyntax(trimmedJql);
    errors.push(...syntaxResult.errors);
    warnings.push(...syntaxResult.warnings);

    // Extract JQL components
    this.extractJqlComponents(trimmedJql, components);

    // Estimate complexity
    const complexity = this.estimateJqlComplexity(trimmedJql, components);
    const recommendedMethod = complexity === 'complex' || trimmedJql.length > 1500 ? 'POST' : 'GET';

    // Performance warnings
    if (this.options.performanceWarnings) {
      if (complexity === 'complex') {
        warnings.push('Complex JQL query detected - consider breaking into simpler queries for better performance');
      }
      if (components.functions.length > 2) {
        warnings.push('Query contains many JQL functions which may impact performance');
      }
    }

    // Generate suggestions
    if (trimmedJql.length > 1500 && !suggestions.some(s => s.includes('POST'))) {
      suggestions.push('Consider using POST method for complex queries over 1500 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
      complexity,
      recommendedMethod,
      components,
    };
  }

  /**
   * Validate maxResults parameter.
   */
  validateMaxResults(maxResults: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof maxResults !== 'number' || !Number.isInteger(maxResults)) {
      errors.push('maxResults must be an integer');
      return { valid: false, errors, warnings };
    }

    if (maxResults < 1) {
      errors.push('maxResults must be at least 1');
    }

    if (maxResults > MAX_RESULTS_LIMIT) {
      errors.push(`maxResults cannot exceed ${MAX_RESULTS_LIMIT}`);
    }

    // Performance warnings
    if (maxResults > 50) {
      warnings.push('Large maxResults values may impact performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate field selection parameter.
   */
  validateFields(fields: FieldSelection): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (typeof fields === 'string') {
      // Special field values
      if (SPECIAL_FIELD_VALUES.includes(fields as any)) {
        if (fields === '*all' && this.options.performanceWarnings) {
          warnings.push('Using "*all" fields may impact performance for large result sets');
          suggestions.push('Consider requesting only specific fields you need');
        }
        return { valid: true, errors, warnings, suggestions, severity: 'info' };
      } else {
        errors.push('String field selection must be "*all" or "*navigable"');
      }
    } else if (Array.isArray(fields)) {
      // Array of field names
      if (fields.length === 0) {
        errors.push('Fields array cannot be empty');
      }

      // Validate individual field names
      for (const field of fields) {
        if (typeof field !== 'string' || field.trim().length === 0) {
          errors.push('Field names must be non-empty strings');
        } else if (!this.isValidFieldName(field)) {
          warnings.push(`Field name "${field}" may not exist or be accessible`);
        }
      }

      // Check for duplicates
      const uniqueFields = new Set(fields);
      if (uniqueFields.size !== fields.length) {
        warnings.push('Duplicate field names detected - duplicates will be ignored');
      }

      // Performance warnings
      if (fields.length > 20) {
        warnings.push('Requesting many fields may impact performance');
        suggestions.push('Consider reducing the number of requested fields');
      }
    } else {
      errors.push('Fields must be an array of strings, "*all", or "*navigable"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      severity: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
    };
  }

  /**
   * Validate expand parameter array.
   */
  validateExpand(expand: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(expand)) {
      errors.push('Expand must be an array of strings');
      return { valid: false, errors, warnings };
    }

    // Validate individual expand values
    const validExpandValues = [
      'changelog', 'renderedFields', 'names', 'schema', 
      'transitions', 'operations', 'editmeta', 'versionedRepresentations',
    ];

    for (const item of expand) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        errors.push('Expand values must be non-empty strings');
      } else if (!validExpandValues.includes(item)) {
        warnings.push(`Expand value "${item}" may not be supported by Jira API`);
      }
    }

    // Check for duplicates
    const uniqueExpands = new Set(expand);
    if (uniqueExpands.size !== expand.length) {
      warnings.push('Duplicate expand values detected - duplicates will be ignored');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate cursor token format.
   */
  validateCursor(cursor: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof cursor !== 'string') {
      errors.push('Cursor must be a string');
      return { valid: false, errors, warnings };
    }

    if (cursor.trim().length === 0) {
      errors.push('Cursor cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Basic format validation (opaque token, but check for common issues)
    if (cursor.includes(' ') || cursor.includes('\n') || cursor.includes('\t')) {
      errors.push('Cursor token contains invalid whitespace characters');
    }

    // Length validation (cursors should be reasonably sized)
    if (cursor.length > 2000) {
      warnings.push('Cursor token is unusually long - verify token validity');
    }

    if (cursor.length < 10) {
      warnings.push('Cursor token is unusually short - verify token validity');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate HTTP method parameter.
   */
  validateMethod(method: HttpMethod): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validMethods: HttpMethod[] = ['auto', 'GET', 'POST'];
    
    if (!validMethods.includes(method)) {
      errors.push('HTTP method must be "auto", "GET", or "POST"');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Perform security checks on JQL query.
   */
  private performSecurityChecks(jql: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for potentially unsafe patterns
    const unsafePatterns = [
      /--/,                    // SQL-style comments
      /\/\*.*?\*\//,          // Block comments
      /<script/i,             // Script injection
      /javascript:/i,         // JavaScript URLs
      /data:.*base64/i,       // Data URLs with base64
      /eval\(/i,              // Eval calls
      /function\(/i,           // Function definitions
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(jql)) {
        warnings.push(`JQL query contains potentially unsafe pattern: ${pattern.source}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate JQL syntax patterns.
   */
  private validateJqlSyntax(jql: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic syntax issues
    const parenCount = (jql.match(/\(/g) || []).length - (jql.match(/\)/g) || []).length;
    if (parenCount !== 0) {
      errors.push('Unmatched parentheses in JQL query');
    }

    // Check for quotes balance
    const singleQuoteCount = (jql.match(/'/g) || []).length;
    const doubleQuoteCount = (jql.match(/"/g) || []).length;
    
    if (singleQuoteCount % 2 !== 0) {
      errors.push('Unmatched single quotes in JQL query');
    }
    
    if (doubleQuoteCount % 2 !== 0) {
      errors.push('Unmatched double quotes in JQL query');
    }

    // Check for required keywords
    if (!/\b(project|issue|status|assignee|reporter|created|updated)\b/i.test(jql)) {
      warnings.push('JQL query should include at least one searchable field');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Extract JQL components for analysis.
   */
  private extractJqlComponents(jql: string, components: JqlValidationResult['components']): void {
    // Extract projects
    const projectMatches = jql.match(/project\s*[=~]\s*["']?([^"'\s,)]+)["']?/gi);
    if (projectMatches) {
      projectMatches.forEach(match => {
        const project = match.replace(/project\s*[=~]\s*["']?/i, '').replace(/["'].*$/, '');
        if (project && !components.projects.includes(project)) {
          components.projects.push(project);
        }
      });
    }

    // Extract operators
    const operatorPatterns = [/\bAND\b/gi, /\bOR\b/gi, /\bNOT\b/gi, /\bIN\b/gi, /\bWAS\b/gi];
    operatorPatterns.forEach(pattern => {
      const matches = jql.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const op = match.toUpperCase();
          if (!components.operators.includes(op)) {
            components.operators.push(op);
          }
        });
      }
    });

    // Extract functions (count all occurrences, not just unique names)
    const functionMatches = jql.match(/\b(membersOf|currentUser|issueHistory|now|startOfDay|endOfDay)\s*\(/gi);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const func = match.replace(/\s*\($/, '');
        components.functions.push(func);
      });
    }

    // Extract common fields
    const commonFields = ['status', 'assignee', 'reporter', 'created', 'updated', 'summary', 'description'];
    commonFields.forEach(field => {
      if (new RegExp(`\\b${field}\\b`, 'i').test(jql) && !components.fields.includes(field)) {
        components.fields.push(field);
      }
    });
  }

  /**
   * Estimate JQL complexity based on various factors.
   */
  private estimateJqlComplexity(jql: string, components: JqlValidationResult['components']): 'simple' | 'moderate' | 'complex' {
    let complexity = 0;

    // Length factor (higher weight for long queries to ensure they're classified as complex)
    if (jql.length > 1500) {
      complexity += 5;
    } else if (jql.length > 500) {
      complexity += 2;
    } else if (jql.length > 100) {
      complexity += 1;
    }

    // Operator complexity
    complexity += components.operators.length;

    // Function complexity
    complexity += components.functions.length * 2;

    // Nesting complexity
    const parenCount = (jql.match(/\(/g) || []).length;
    if (parenCount > 3) {
      complexity += 3;
    } else if (parenCount > 1) {
      complexity += 1;
    }

    // Determine complexity level
    if (complexity <= 2) {
      return 'simple';
    }
    if (complexity <= 5) {
      return 'moderate';
    }
    return 'complex';
  }

  /**
   * Check if a field name is valid.
   */
  private isValidFieldName(fieldName: string): boolean {
    // Common system fields
    const systemFields = [
      'id', 'key', 'self', 'summary', 'description', 'status', 'assignee', 'reporter',
      'created', 'updated', 'resolved', 'duedate', 'priority', 'issuetype', 'project',
      'labels', 'components', 'fixVersions', 'versions', 'resolution', 'resolutiondate',
      'timetracking', 'environment', 'attachment', 'comment', 'worklog',
    ];

    if (systemFields.includes(fieldName.toLowerCase())) {
      return true;
    }

    // Custom field patterns
    return this.options.customFieldPatterns.some(pattern => pattern.test(fieldName));
  }
}

/**
 * Convenience functions for common validation tasks.
 */

/**
 * Create a parameter validator with default options.
 */
export function createValidator(options?: ValidationOptions): ParameterValidator {
  return new ParameterValidator(options);
}

/**
 * Quick validation for JQL query strings.
 */
export function validateJqlQuick(jql: string): ValidationResult {
  const validator = new ParameterValidator();
  return validator.validateJql(jql);
}

/**
 * Quick validation for search request parameters.
 */
export function validateSearchRequestQuick(request: SearchRequest): ValidationResult {
  const validator = new ParameterValidator();
  return validator.validateSearchRequest(request);
}

/**
 * Validate and normalize a legacy request to modern format.
 */
export function validateAndNormalizeLegacyRequest(request: LegacySearchRequest): {
  validation: EnhancedValidationResult;
  normalized: SearchRequest;
} {
  const validator = new ParameterValidator();
  const validation = validator.validateLegacyRequest(request);

  // Normalize to modern format
  const normalized: SearchRequest = {
    jql: request.jql,
    maxResults: request.limit ?? request.maxResults,
    fields: request.fields,
    expand: request.expand,
    cursor: request.cursor,
    method: request.method,
  };

  return { validation, normalized };
}