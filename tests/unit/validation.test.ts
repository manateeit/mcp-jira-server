/**
 * Unit tests for parameter validation utilities
 * 
 * This test suite validates the parameter validation utilities
 * for Enhanced JQL API requests and parameters.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ParameterValidator,
  createValidator,
  validateJqlQuick,
  validateSearchRequestQuick,
  validateAndNormalizeLegacyRequest,
  DEFAULT_VALIDATION_OPTIONS
} from '../../src/jira/validation';
import { SearchRequest, LegacySearchRequest } from '../../src/jira/types';

describe('Parameter Validation Utilities', () => {
  let validator: ParameterValidator;

  beforeEach(() => {
    validator = new ParameterValidator();
  });

  describe('ParameterValidator Creation', () => {
    it('should create validator with default options', () => {
      const validator = createValidator();
      expect(validator).toBeInstanceOf(ParameterValidator);
    });

    it('should create validator with custom options', () => {
      const validator = createValidator({
        strict: true,
        performanceWarnings: false,
        securityChecks: false
      });
      expect(validator).toBeInstanceOf(ParameterValidator);
    });

    it('should use default validation options', () => {
      expect(DEFAULT_VALIDATION_OPTIONS.strict).toBe(false);
      expect(DEFAULT_VALIDATION_OPTIONS.performanceWarnings).toBe(true);
      expect(DEFAULT_VALIDATION_OPTIONS.securityChecks).toBe(true);
      expect(DEFAULT_VALIDATION_OPTIONS.maxJqlLength).toBe(100000);
    });
  });

  describe('Search Request Validation', () => {
    it('should validate valid search request', () => {
      const request: SearchRequest = {
        jql: 'project = TEST ORDER BY created DESC',
        maxResults: 25
      };

      const result = validator.validateSearchRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request without JQL', () => {
      const request = {} as SearchRequest;

      const result = validator.validateSearchRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JQL query is required');
      expect(result.severity).toBe('critical');
    });

    it('should reject request with empty JQL', () => {
      const request: SearchRequest = {
        jql: '   '  // whitespace only
      };

      const result = validator.validateSearchRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('JQL query cannot be empty or whitespace only');
    });

    it('should validate all parameters together', () => {
      const request: SearchRequest = {
        jql: 'project = TEST',
        maxResults: 10,
        fields: ['id', 'key', 'summary'],
        expand: ['changelog'],
        cursor: 'valid-cursor-token',
        method: 'POST'
      };

      const result = validator.validateSearchRequest(request);
      expect(result.valid).toBe(true);
      expect(result.severity).toBe('info');
    });
  });

  describe('Legacy Request Validation', () => {
    it('should validate legacy request with migration warnings', () => {
      const request: LegacySearchRequest = {
        jql: 'project = TEST',
        limit: 25,
        startAt: 0
      };

      const result = validator.validateLegacyRequest(request);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Parameter "limit" is deprecated, use "maxResults" instead');
      expect(result.warnings).toContain('Parameter "startAt" is deprecated, use cursor-based pagination instead');
      expect(result.suggestions).toContain('Replace "limit" with "maxResults" for Enhanced JQL API compatibility');
      expect(result.suggestions).toContain('Switch to cursor-based pagination using "cursor" parameter for better performance');
    });

    it('should validate legacy limit constraints', () => {
      const request: LegacySearchRequest = {
        jql: 'project = TEST',
        limit: 150 // Exceeds limit
      };

      const result = validator.validateLegacyRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Legacy "limit" parameter cannot exceed 100');
    });

    it('should validate negative startAt values', () => {
      const request: LegacySearchRequest = {
        jql: 'project = TEST',
        startAt: -5
      };

      const result = validator.validateLegacyRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Legacy "startAt" parameter must be non-negative');
    });
  });

  describe('JQL Validation', () => {
    it('should validate simple JQL queries', () => {
      const result = validator.validateJql('project = TEST');
      expect(result.valid).toBe(true);
      expect(result.complexity).toBe('simple');
      expect(result.recommendedMethod).toBe('GET');
      expect(result.components.projects).toContain('TEST');
    });

    it('should validate complex JQL queries', () => {
      const complexJql = 'project = TEST AND '.repeat(100) + 'status = Open';
      const result = validator.validateJql(complexJql);
      
      expect(result.valid).toBe(true);
      expect(result.complexity).toBe('complex');
      expect(result.recommendedMethod).toBe('POST');
    });

    it('should detect JQL syntax errors', () => {
      const result = validator.validateJql('project = TEST AND (status = Open');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched parentheses in JQL query');
    });

    it('should detect unmatched quotes', () => {
      const result = validator.validateJql('project = "TEST');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unmatched double quotes in JQL query');
    });

    it('should extract JQL components', () => {
      const result = validator.validateJql('project = AIS360 AND status = Open AND assignee in membersOf("developers")');
      
      expect(result.components.projects).toContain('AIS360');
      expect(result.components.operators).toContain('AND');
      expect(result.components.operators).toContain('IN');
      expect(result.components.functions).toContain('membersOf');
      expect(result.components.fields).toContain('status');
    });

    it('should detect security issues', () => {
      const result = validator.validateJql('project = TEST -- AND DROP TABLE users');
      expect(result.warnings.some(w => w.includes('unsafe pattern'))).toBe(true);
    });

    it('should handle performance warnings', () => {
      const validator = createValidator({ performanceWarnings: true });
      const complexJql = 'project = TEST AND assignee in membersOf("team1") AND reporter in membersOf("team2") AND created >= currentUser()';
      
      const result = validator.validateJql(complexJql);
      expect(result.components.functions.length).toBeGreaterThanOrEqual(2); // Should have at least 2 functions
      expect(result.warnings.some(w => w.includes('many JQL functions'))).toBe(true);
    });
  });

  describe('MaxResults Validation', () => {
    it('should validate valid maxResults values', () => {
      const result = validator.validateMaxResults(25);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-integer values', () => {
      const result = validator.validateMaxResults(25.5);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxResults must be an integer');
    });

    it('should reject values less than 1', () => {
      const result = validator.validateMaxResults(0);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxResults must be at least 1');
    });

    it('should reject values greater than limit', () => {
      const result = validator.validateMaxResults(150);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxResults cannot exceed 100');
    });

    it('should warn about performance impact', () => {
      const result = validator.validateMaxResults(75);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Large maxResults values may impact performance');
    });
  });

  describe('Fields Validation', () => {
    it('should validate special field values', () => {
      const result = validator.validateFields('*all');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('performance'))).toBe(true);
    });

    it('should validate field arrays', () => {
      const result = validator.validateFields(['id', 'key', 'summary']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty field arrays', () => {
      const result = validator.validateFields([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fields array cannot be empty');
    });

    it('should validate individual field names', () => {
      const result = validator.validateFields(['id', '', 'summary']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field names must be non-empty strings');
    });

    it('should warn about duplicate fields', () => {
      const result = validator.validateFields(['id', 'summary', 'id']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Duplicate field names detected - duplicates will be ignored');
    });

    it('should warn about too many fields', () => {
      const manyFields = Array.from({ length: 25 }, (_, i) => `field${i}`);
      const result = validator.validateFields(manyFields);
      expect(result.warnings).toContain('Requesting many fields may impact performance');
    });

    it('should reject invalid field format', () => {
      const result = validator.validateFields(123 as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fields must be an array of strings, "*all", or "*navigable"');
    });
  });

  describe('Expand Validation', () => {
    it('should validate valid expand values', () => {
      const result = validator.validateExpand(['changelog', 'renderedFields']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array values', () => {
      const result = validator.validateExpand('changelog' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expand must be an array of strings');
    });

    it('should warn about unknown expand values', () => {
      const result = validator.validateExpand(['changelog', 'unknownExpand']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Expand value "unknownExpand" may not be supported by Jira API');
    });

    it('should reject empty expand values', () => {
      const result = validator.validateExpand(['changelog', '']);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Expand values must be non-empty strings');
    });

    it('should warn about duplicate expand values', () => {
      const result = validator.validateExpand(['changelog', 'changelog']);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Duplicate expand values detected - duplicates will be ignored');
    });
  });

  describe('Cursor Validation', () => {
    it('should validate valid cursor tokens', () => {
      const result = validator.validateCursor('eyJzZWFyY2hBZnRlciI6WyJBSVMzNjAtMTIzIl19');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-string cursors', () => {
      const result = validator.validateCursor(123 as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cursor must be a string');
    });

    it('should reject empty cursors', () => {
      const result = validator.validateCursor('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cursor cannot be empty');
    });

    it('should reject cursors with whitespace', () => {
      const result = validator.validateCursor('invalid cursor token');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cursor token contains invalid whitespace characters');
    });

    it('should warn about unusual cursor lengths', () => {
      const shortResult = validator.validateCursor('abc');
      expect(shortResult.warnings).toContain('Cursor token is unusually short - verify token validity');

      const longCursor = 'a'.repeat(2500);
      const longResult = validator.validateCursor(longCursor);
      expect(longResult.warnings).toContain('Cursor token is unusually long - verify token validity');
    });
  });

  describe('HTTP Method Validation', () => {
    it('should validate valid HTTP methods', () => {
      expect(validator.validateMethod('auto').valid).toBe(true);
      expect(validator.validateMethod('GET').valid).toBe(true);
      expect(validator.validateMethod('POST').valid).toBe(true);
    });

    it('should reject invalid HTTP methods', () => {
      const result = validator.validateMethod('PUT' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTP method must be "auto", "GET", or "POST"');
    });
  });

  describe('Convenience Functions', () => {
    it('should provide quick JQL validation', () => {
      const result = validateJqlQuick('project = TEST');
      expect(result.valid).toBe(true);
    });

    it('should provide quick search request validation', () => {
      const request: SearchRequest = {
        jql: 'project = TEST',
        maxResults: 10
      };
      const result = validateSearchRequestQuick(request);
      expect(result.valid).toBe(true);
    });

    it('should validate and normalize legacy requests', () => {
      const legacyRequest: LegacySearchRequest = {
        jql: 'project = TEST',
        limit: 25,
        startAt: 0
      };

      const { validation, normalized } = validateAndNormalizeLegacyRequest(legacyRequest);
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(normalized.maxResults).toBe(25);
      expect(normalized.jql).toBe('project = TEST');
    });
  });

  describe('Security Validation', () => {
    it('should detect script injection attempts', () => {
      const validator = createValidator({ securityChecks: true });
      const result = validator.validateJql('project = TEST AND summary ~ "<script>alert(1)</script>"');
      expect(result.warnings.some(w => w.includes('unsafe pattern'))).toBe(true);
    });

    it('should detect comment injection', () => {
      const validator = createValidator({ securityChecks: true });
      const result = validator.validateJql('project = TEST /* malicious comment */');
      expect(result.warnings.some(w => w.includes('unsafe pattern'))).toBe(true);
    });

    it('should allow disabling security checks', () => {
      const validator = createValidator({ securityChecks: false });
      const result = validator.validateJql('project = TEST /* comment */');
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('Performance Options', () => {
    it('should provide performance warnings when enabled', () => {
      const validator = createValidator({ performanceWarnings: true });
      const result = validator.validateFields('*all');
      expect(result.warnings.some(w => w.includes('performance'))).toBe(true);
    });

    it('should skip performance warnings when disabled', () => {
      const validator = createValidator({ performanceWarnings: false });
      const result = validator.validateFields('*all');
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('Strict Mode', () => {
    it('should apply stricter validation in strict mode', () => {
      const validator = createValidator({ strict: true });
      // Strict mode would apply more rigorous validation
      // This is a placeholder for potential future strict mode features
      expect(validator).toBeInstanceOf(ParameterValidator);
    });
  });
});