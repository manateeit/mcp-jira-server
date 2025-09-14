# Implementation Plan: Migrate Jira MCP search to Enhanced JQL API

**Branch**: `001-title-migrate-jira` | **Date**: 2025-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-title-migrate-jira/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Feature spec loaded: Enhanced JQL API migration
2. Fill Technical Context (scan for NEEDS CLARIFICATION) ✓
   → Detected Project Type: single (MCP server)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below ✓
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md ✓
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md ✓
6. Re-evaluate Constitution Check section ✓
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md) ✓
8. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Migrate the Jira MCP server's `search-issues` tool from the deprecated `/rest/api/3/search` API to the new Enhanced JQL API (`/rest/api/3/search/jql`). The migration must maintain backward compatibility while enabling cursor-based pagination and automatic HTTP method selection based on query complexity.

## Technical Context
**Language/Version**: TypeScript 5.x (Node.js MCP server)  
**Primary Dependencies**: @modelcontextprotocol/sdk, axios or fetch for HTTP requests  
**Storage**: N/A (API client only)  
**Testing**: Jest or similar testing framework  
**Target Platform**: Node.js 18+ (MCP server runtime)  
**Project Type**: single (MCP server library)  
**Performance Goals**: Handle JQL queries up to 10MB, support paginated results for 10k+ issues  
**Constraints**: Maintain 100% backward compatibility with existing MCP tool signature, <2s response time for simple queries  
**Scale/Scope**: Single MCP tool migration affecting search-issues functionality

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (MCP server only)
- Using framework directly? Yes (direct Jira REST API calls)
- Single data model? Yes (Jira issue entities)
- Avoiding patterns? Yes (no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? N/A (single tool migration)
- Libraries listed: Enhanced JQL client (purpose: API abstraction)
- CLI per library: MCP tool interface (search-issues command)
- Library docs: Will be documented in MCP tool schema

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes (tests first, then implementation)
- Git commits show tests before implementation? Will be enforced
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (actual Jira Cloud instance for integration tests)
- Integration tests for: API endpoint changes, pagination cursors, field selection
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? Yes (MCP server logging)
- Frontend logs → backend? N/A (server-side only)
- Error context sufficient? Yes (detailed API error responses)

**Versioning**:
- Version number assigned? Yes (will increment BUILD version)
- BUILD increments on every change? Yes
- Breaking changes handled? N/A (maintaining backward compatibility)

## Project Structure

### Documentation (this feature)
```
specs/001-title-migrate-jira/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── jira/
│   ├── client.ts        # Enhanced JQL API client
│   ├── types.ts         # Response/request interfaces
│   └── search.ts        # Search tool implementation
└── tools/
    └── search-issues.ts # MCP tool definition

tests/
├── integration/
│   ├── search-api.test.ts      # Real Jira API tests
│   └── pagination.test.ts      # Cursor navigation tests
├── contract/
│   └── search-tool.test.ts     # MCP tool contract tests
└── unit/
    ├── client.test.ts          # HTTP client logic
    └── parameter-mapping.test.ts # Backward compatibility
```

**Structure Decision**: Option 1 (Single project) - MCP server with modular internal structure

## Phase 0: Outline & Research

Research completed - generating research.md with findings on Enhanced JQL API migration requirements.

## Phase 1: Design & Contracts

Design completed - generating data-model.md, contracts/, and quickstart.md with API specifications and test scenarios.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- HTTP client contract tests → API endpoint validation [P]
- Parameter mapping tests → backward compatibility validation [P]
- Response normalization tests → data consistency validation [P]
- Integration tests → real API interaction validation
- Error handling tests → edge case coverage [P]

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Unit tests → Implementation
- Dependency order: Types/interfaces → HTTP client → MCP tool → Integration
- Mark [P] for parallel execution (independent test files)

**Estimated Output**: 12-15 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No constitutional violations identified - migration maintains existing architecture patterns*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*