import type { JiraIssue, JiraSearchResult } from '../types/jira.js';
import type { SearchResponse, ResponseMetadata } from '../jira/types.js';

export class JiraFormatter {
  static formatIssue(issue: JiraIssue): string {
    const fields = issue.fields;
    const lines: string[] = [
      `🎫 ${issue.key}: ${fields.summary}`,
      `📊 Status: ${fields.status.name}`,
      `🔧 Type: ${fields.issuetype.name}`,
      `📅 Created: ${new Date(fields.created).toLocaleDateString()}`,
      `📅 Updated: ${new Date(fields.updated).toLocaleDateString()}`,
    ];

    if (fields.assignee) {
      lines.push(`👤 Assignee: ${fields.assignee.displayName}`);
    }

    if (fields.reporter) {
      lines.push(`📝 Reporter: ${fields.reporter.displayName}`);
    }

    if (fields.priority) {
      lines.push(`⚡ Priority: ${fields.priority.name}`);
    }

    if (fields.labels && fields.labels.length > 0) {
      lines.push(`🏷️  Labels: ${fields.labels.join(', ')}`);
    }

    if (fields.components && fields.components.length > 0) {
      lines.push(`📦 Components: ${fields.components.map(c => c.name).join(', ')}`);
    }

    if (fields.description) {
      lines.push('');
      lines.push('📄 Description:');
      lines.push(this.formatDescription(fields.description));
    }

    const customFields = this.getCustomFields(fields);
    if (customFields.length > 0) {
      lines.push('');
      lines.push('🔧 Custom Fields:');
      customFields.forEach(field => lines.push(field));
    }

    return lines.join('\n');
  }

  static formatSearchResults(results: JiraSearchResult): string {
    if (results.total === 0) {
      return '🔍 No issues found';
    }

    const lines: string[] = [
      `🔍 Found ${results.total} issue(s) (showing ${results.issues.length})`,
      '',
    ];

    results.issues.forEach((issue, index) => {
      lines.push(`${index + 1}. ${issue.key}: ${issue.fields.summary}`);
      lines.push(`   Status: ${issue.fields.status.name} | Type: ${issue.fields.issuetype.name}`);
      if (issue.fields.assignee) {
        lines.push(`   Assignee: ${issue.fields.assignee.displayName}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format Enhanced JQL API search responses with comprehensive metadata
   */
  static formatEnhancedSearchResults(response: SearchResponse): string {
    if (response.issues.length === 0) {
      return '🔍 No issues found';
    }

    // Calculate pagination statistics for better display
    const paginationStats = this.calculatePaginationStats(response);
    
    const lines: string[] = [
      `🔍 Found ${response.total !== undefined ? response.total : response.issues.length} issue(s) (showing ${response.issues.length})`,
      `📄 ${paginationStats.progress}`,
      '',
    ];

    // Format issues
    response.issues.forEach((issue, index) => {
      lines.push(`${index + 1}. ${issue.key}: ${issue.fields.summary || 'No summary'}`);
      lines.push(`   Status: ${issue.fields.status?.name || 'Unknown'} | Type: ${issue.fields.issuetype?.name || 'Unknown'}`);
      if (issue.fields.assignee) {
        lines.push(`   Assignee: ${issue.fields.assignee.displayName}`);
      }
      lines.push('');
    });

    // Add Enhanced JQL API metadata
    const metadata = this.formatResponseMetadata(response.meta);
    if (metadata) {
      lines.push('📊 Response Metadata:');
      lines.push(metadata);
    }

    // Add enhanced cursor-based pagination information
    const paginationInfo = this.formatPaginationInfo(response);
    if (paginationInfo) {
      lines.push('');
      lines.push('📄 Pagination Information:');
      lines.push(paginationInfo);
    }

    return lines.join('\n');
  }

  /**
   * Format cursor-based pagination information with user guidance
   */
  static formatPaginationInfo(response: SearchResponse): string {
    const lines: string[] = [];
    
    // Determine pagination status with improved logic
    const startAt = response.startAt || 0;
    const isFirstPage = startAt === 0;
    const hasNextPage = response.cursor !== null && response.cursor !== undefined && response.cursor !== '';
    const isLastPage = !hasNextPage;
    
    // Current page information
    const currentPageSize = response.issues.length;
    const maxResults = response.maxResults || 50; // Default maxResults from Enhanced JQL API
    
    if (response.total !== undefined) {
      // When total count is available
      const startIndex = (response.startAt || 0) + 1;
      const endIndex = startIndex + currentPageSize - 1;
      lines.push(`   📊 Results: ${startIndex}-${endIndex} of ${response.total} total issues`);
      
      if (response.total > endIndex) {
        const remainingResults = response.total - endIndex;
        lines.push(`   ⏭️  Remaining: ${remainingResults} more issues available`);
      }
    } else {
      // Cursor-based pagination without total count
      lines.push(`   📊 Current page: ${currentPageSize} issues (max: ${maxResults})`);
      
      if (hasNextPage) {
        lines.push('   ⏭️  More results: Additional pages available');
      }
    }
    
    // Pagination status indicators
    if (isFirstPage && isLastPage) {
      lines.push('   ✅ Complete: All results shown on this page');
    } else if (isFirstPage && hasNextPage) {
      lines.push('   🟢 First page: This is the beginning of results');
    } else if (isLastPage) {
      lines.push('   🔴 Final page: No more results available');
    } else {
      lines.push('   🟡 Middle page: More results before and after');
    }
    
    // Navigation guidance
    if (hasNextPage) {
      lines.push('');
      lines.push('   🔄 Next Page Instructions:');
      lines.push('     Add this parameter to your search request:');
      lines.push(`     "cursor": "${response.cursor}"`);
      lines.push('');
      lines.push('   💡 Example MCP call for next page:');
      lines.push('     {');
      lines.push('       "tool": "search-issues",');
      lines.push('       "arguments": {');
      lines.push('         "jql": "<your-original-jql-query>",');
      lines.push(`         "cursor": "${response.cursor}",`);
      lines.push(`         "maxResults": ${maxResults}`);
      lines.push('       }');
      lines.push('     }');
    }
    
    // Backward compatibility notice
    if (response.startAt !== undefined || response.maxResults !== undefined) {
      lines.push('');
      lines.push('   ℹ️  Compatibility: Legacy pagination fields included for backward compatibility');
      if (response.startAt !== undefined) {
        lines.push(`      startAt: ${response.startAt}`);
      }
      if (response.maxResults !== undefined) {
        lines.push(`      maxResults: ${response.maxResults}`);
      }
    }
    
    // Performance tip
    if (currentPageSize === maxResults && hasNextPage) {
      lines.push('');
      lines.push('   ⚡ Performance tip: Consider using field selection ("fields" parameter)');
      lines.push('     to reduce response size when paginating through large result sets');
    }
    
    return lines.length > 0 ? lines.join('\n') : '';
  }

  /**
   * Generate a ready-to-use MCP tool request for the next page of results
   */
  static createNextPageRequest(originalJql: string, response: SearchResponse, maxResults?: number): object | null {
    if (!response.cursor) {
      return null; // No next page available
    }

    return {
      tool: 'search-issues',
      arguments: {
        jql: originalJql,
        cursor: response.cursor,
        maxResults: maxResults || response.maxResults || 50,
        // Include fields and expand if they were in the original response metadata
        ...(response.meta.requestId && { 
          // Note: We can't recover original fields/expand from response, 
          // but we provide the structure for manual completion
        }),
      },
    };
  }

  /**
   * Calculate pagination statistics for display
   */
  static calculatePaginationStats(response: SearchResponse): {
    currentPage: number;
    totalPages?: number;
    hasNext: boolean;
    hasPrevious: boolean;
    progress: string;
  } {
    const maxResults = response.maxResults || 50;
    const hasNext = response.cursor !== null && response.cursor !== undefined;
    const startAt = response.startAt || 0;
    
    // Calculate current page number (1-based)
    const currentPage = Math.floor(startAt / maxResults) + 1;
    const hasPrevious = startAt > 0;
    
    let totalPages: number | undefined;
    let progress: string;
    
    if (response.total !== undefined) {
      // When total count is available, we can calculate exact pages
      totalPages = Math.ceil(response.total / maxResults);
      progress = `Page ${currentPage} of ${totalPages}`;
    } else {
      // Cursor-based pagination without total count
      if (hasNext) {
        progress = `Page ${currentPage} (more available)`;
      } else {
        progress = `Page ${currentPage} (final page)`;
      }
    }
    
    return {
      currentPage,
      totalPages,
      hasNext,
      hasPrevious,
      progress,
    };
  }

  /**
   * Format response metadata from Enhanced JQL API
   */
  static formatResponseMetadata(meta: ResponseMetadata): string {
    const lines: string[] = [];

    // Timing information
    if (meta.timing) {
      lines.push(`   ⏱️  Response time: ${meta.timing.duration}ms`);
      lines.push(`   📅 Request time: ${new Date(meta.timing.requestTime).toISOString()}`);
    }

    // HTTP method used
    if (meta.httpMethod) {
      lines.push(`   🌐 HTTP method: ${meta.httpMethod}`);
    }

    // Rate limit information
    if (meta.rateLimit) {
      lines.push(`   ⏳ Rate limit: ${meta.rateLimit.remaining} requests remaining`);
      if (meta.rateLimit.retryAfter) {
        lines.push(`   ⚠️  Rate limited: Retry after ${meta.rateLimit.retryAfter}s`);
      }
    }

    // API warnings
    if (meta.warnings && meta.warnings.length > 0) {
      lines.push('   ⚠️  Warnings:');
      meta.warnings.forEach(warning => {
        lines.push(`      • ${warning}`);
      });
    }

    // Request ID for debugging
    if (meta.requestId) {
      lines.push(`   🔍 Request ID: ${meta.requestId}`);
    }

    return lines.join('\n');
  }

  /**
   * Smart formatter that chooses between legacy and Enhanced JQL API formatting
   * based on the presence of Enhanced JQL metadata
   */
  static formatSearchResultsSmart(results: JiraSearchResult | SearchResponse): string {
    // Check if this is an Enhanced JQL API response (has meta property)
    if ('meta' in results && results.meta) {
      return this.formatEnhancedSearchResults(results as SearchResponse);
    }
    
    // Fall back to legacy formatter for backward compatibility
    return this.formatSearchResults(results as JiraSearchResult);
  }

  static formatIssueLink(issueKey: string, host: string): string {
    return `${host}/browse/${issueKey}`;
  }

  private static formatDescription(description: any): string {
    if (typeof description === 'string') {
      return description;
    }

    if (description && description.content) {
      return this.parseAtlassianDocument(description);
    }

    return 'No description';
  }

  private static parseAtlassianDocument(doc: any): string {
    const lines: string[] = [];

    const parseContent = (content: any[]): string => {
      return content
        .map(item => {
          switch (item.type) {
            case 'text':
              return item.text;
            case 'hardBreak':
              return '\n';
            case 'mention':
              return `@${item.attrs.text}`;
            case 'emoji':
              return item.attrs.shortName;
            default:
              return '';
          }
        })
        .join('');
    };

    if (doc.content) {
      doc.content.forEach((block: any) => {
        switch (block.type) {
          case 'paragraph':
            if (block.content) {
              lines.push(parseContent(block.content));
            }
            break;
          case 'heading':
            if (block.content) {
              const level = block.attrs?.level || 1;
              const prefix = '#'.repeat(level) + ' ';
              lines.push(prefix + parseContent(block.content));
            }
            break;
          case 'bulletList':
          case 'orderedList':
            if (block.content) {
              block.content.forEach((item: any, index: number) => {
                const prefix = block.type === 'bulletList' ? '• ' : `${index + 1}. `;
                if (item.content && item.content[0]?.content) {
                  lines.push(prefix + parseContent(item.content[0].content));
                }
              });
            }
            break;
          case 'codeBlock':
            lines.push('```');
            if (block.content) {
              lines.push(parseContent(block.content));
            }
            lines.push('```');
            break;
        }
      });
    }

    return lines.join('\n');
  }

  private static getCustomFields(fields: any): string[] {
    const customFields: string[] = [];

    Object.entries(fields).forEach(([key, value]) => {
      if (key.startsWith('customfield_') && value !== null) {
        const displayValue = this.formatCustomFieldValue(value);
        if (displayValue) {
          customFields.push(`  ${key}: ${displayValue}`);
        }
      }
    });

    return customFields;
  }

  private static formatCustomFieldValue(value: any): string {
    if (typeof value === 'string' || typeof value === 'number') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map(v => this.formatCustomFieldValue(v)).join(', ');
    }

    if (value && typeof value === 'object') {
      if (value.name) {
        return value.name;
      }
      if (value.value) {
        return value.value;
      }
      if (value.displayName) {
        return value.displayName;
      }
    }

    return '';
  }
}
