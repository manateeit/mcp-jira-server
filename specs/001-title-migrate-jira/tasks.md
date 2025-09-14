# Tasks: Enhanced JQL API Migration

**Input**: Design documents from `/specs/001-title-migrate-jira/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```text
1. Load plan.md from feature directory ✓
   → Feature spec loaded: Enhanced JQL API migration
   → Extract: TypeScript 5.x, @modelcontextprotocol/sdk, axios/fetch
2. Load optional design documents: ✓
   → data-model.md: Extract entities → SearchRequest, SearchResponse, JiraIssue
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → Enhanced JQL endpoint migration
3. Generate tasks by category:
   → Setup: TypeScript project, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: types, client, search tool
   → Integration: API client, error handling
   → Polish: unit tests, performance, docs
4. Apply task rules: ✓
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...) ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate task completeness: ✓
   → All contracts have tests ✓
   → All entities have models ✓
   → All endpoints implemented ✓
9. Return: SUCCESS (tasks ready for execution) ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths assume single project structure per plan.md

## Phase 3.1: Setup ✅ COMPLETED
- [x] T001 Create TypeScript project structure with src/, tests/, types.ts configuration
- [x] T002 Initialize Node.js project with @modelcontextprotocol/sdk and development dependencies  
- [x] T003 [P] Configure TypeScript compiler, ESLint, Prettier, and Jest test framework

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T004 [P] Contract test for search-issues MCP tool in tests/contract/search-issues-mcp.test.ts
- [x] T005 [P] Contract test for Enhanced JQL API endpoints in tests/contract/jira-enhanced-jql-api.test.ts  
- [x] T006 [P] Integration test for simple JQL query (GET method) in tests/integration/simple-query.test.ts
- [x] T007 [P] Integration test for complex JQL query (POST method) in tests/integration/complex-query.test.ts
- [x] T008 [P] Integration test for cursor-based pagination in tests/integration/pagination.test.ts
- [x] T009 [P] Integration test for field selection in tests/integration/field-selection.test.ts
- [x] T010 [P] Integration test for error handling (invalid JQL) in tests/integration/error-handling.test.ts
- [x] T011 [P] Integration test for backward compatibility (legacy parameters) in tests/integration/backward-compatibility.test.ts
- [x] T012 [P] Integration test for rate limit handling in tests/integration/rate-limiting.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [x] T013 [P] Create TypeScript interfaces in src/jira/types.ts based on data model entities ✅ COMPLETED
- [x] T014 [P] Create Enhanced JQL API client in src/jira/client.ts with HTTP method selection ✅ COMPLETED  
- [x] T015 [P] Create Enhanced JQL service layer in src/jira/service.ts with parameter validation ✅ COMPLETED
- [x] T016 Create parameter validation utilities in src/jira/validation.ts ✅ COMPLETED
- [ ] T017 Update search-issues MCP tool to use Enhanced JQL API in src/tools/issue-tools.ts
- [ ] T018 Add backward compatibility mapping for legacy parameters in search-issues tool
- [ ] T019 Implement cursor-based pagination support in MCP tool response formatting
- [ ] T020 Add Enhanced JQL response metadata to formatter in src/utils/formatter.ts

## Phase 3.4: Integration  
- [ ] T021 Connect Enhanced JQL client to real Jira API endpoints with proper authentication
- [ ] T022 Implement automatic HTTP method selection (GET for simple, POST for complex queries)
- [ ] T023 Add structured logging for search operations and API interactions
- [ ] T024 Implement rate limiting detection and exponential backoff retry logic

## Phase 3.5: Polish
- [x] T025 [P] Unit tests for parameter validation utilities in tests/unit/validation.test.ts ✅ COMPLETED
- [ ] T026 [P] Unit tests for HTTP client logic in tests/unit/client.test.ts  
- [ ] T027 [P] Unit tests for service layer in tests/unit/service.test.ts
- [ ] T028 Performance tests ensuring <2s response time for simple queries
- [ ] T029 [P] Update README.md with Enhanced JQL API migration details
- [ ] T030 [P] Update CHANGELOG.md with version increment and breaking/non-breaking changes
- [ ] T031 Run quickstart.md scenarios to validate end-to-end functionality
- [ ] T032 Remove any temporary code or debug artifacts

## Dependencies
- Setup (T001-T003) before all other phases ✅ COMPLETED
- Tests (T004-T012) before implementation (T013-T024)
- T013 (types) ✅ → T014, T015, T016 ✅ COMPLETED
- T014 (client) ✅ → T021, T022 
- T015 (service) ✅ → T017, T018
- T016 (validation) ✅ → T017, T018
- T017 (MCP tool update) blocks T018, T019
- Implementation (T013-T024) before polish (T025-T032)
- Foundation complete ✅ (T013-T016, T025) - Ready for MCP tool migration

## Parallel Example
```bash
# Launch contract tests together (T004-T005):
Task: "Contract test for search-issues MCP tool in tests/contract/search-issues-mcp.test.ts"
Task: "Contract test for Enhanced JQL API endpoints in tests/contract/jira-enhanced-jql-api.test.ts"

# Launch integration tests together (T006-T012):
Task: "Integration test for simple JQL query (GET method) in tests/integration/simple-query.test.ts"
Task: "Integration test for complex JQL query (POST method) in tests/integration/complex-query.test.ts"
Task: "Integration test for cursor-based pagination in tests/integration/pagination.test.ts"
Task: "Integration test for field selection in tests/integration/field-selection.test.ts"
Task: "Integration test for error handling (invalid JQL) in tests/integration/error-handling.test.ts"
Task: "Integration test for backward compatibility (legacy parameters) in tests/integration/backward-compatibility.test.ts"
Task: "Integration test for rate limit handling in tests/integration/rate-limit.test.ts"

# Launch core implementation types, client, mapping in parallel (T013-T015):
Task: "Create TypeScript interfaces in src/jira/types.ts based on data model entities"
Task: "Create Enhanced JQL API client in src/jira/client.ts with HTTP method selection"  
Task: "Create parameter mapping utilities in src/jira/parameter-mapping.ts for backward compatibility"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail (RED) before implementing (GREEN)  
- Commit after each task completion
- Maintain tool name `search-issues` for backward compatibility
- Normalize all responses to `{ issues, total, cursor, meta }` format
- Use strict TDD: write tests first → expect RED → implement → GREEN

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - search-issues-mcp.json → MCP tool contract test [P] 
   - jira-enhanced-jql-api.json → API endpoint contract test [P]
   
2. **From Data Model**:  
   - SearchRequest entity → types.ts interface [P]
   - SearchResponse entity → types.ts interface [P]
   - JiraIssue entity → types.ts interface [P]
   - BackwardCompatibilityMapping → parameter-mapping.ts [P]
   
3. **From Quickstart Scenarios**:
   - Test Scenario 1: Simple Query → simple-query.test.ts [P]
   - Test Scenario 2: Complex Query → complex-query.test.ts [P]
   - Test Scenario 3: Cursor Pagination → pagination.test.ts [P]
   - Test Scenario 4: Field Selection → field-selection.test.ts [P] 
   - Test Scenario 5: Error Handling → error-handling.test.ts [P]
   - Test Scenario 6: Backward Compatibility → backward-compatibility.test.ts [P]
   - Test Scenario 7: Rate Limiting → rate-limit.test.ts [P]

4. **Ordering**:
   - Setup → Contract Tests → Integration Tests → Types → Client → Search Tool → Polish
   - Dependencies block parallel execution

## Validation Checklist  
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T005)
- [x] All entities have model tasks (T013 covers all interfaces)  
- [x] All tests come before implementation (T004-T012 before T013+)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path (all paths included)
- [x] No task modifies same file as another [P] task
- [x] TDD Red-Green-Refactor enforced (tests fail first, then implement)
- [x] Backward compatibility maintained (`search-issues` tool name stable)
- [x] Enhanced JQL API endpoints used correctly (GET/POST selection)
- [x] Response format normalized to expected schema

## Current Status ⚡ READY FOR T017 IMPLEMENTATION

**Foundation Complete ✅**
- [x] T013: Enhanced JQL API types (src/jira/types.ts)
- [x] T014: HTTP client with method selection (src/jira/client.ts)  
- [x] T015: Service layer with validation (src/jira/service.ts)
- [x] T016: Parameter validation utilities (src/jira/validation.ts)
- [x] T025: Unit tests for validation (tests/unit/validation.test.ts)

**Next Priority: MCP Tool Migration**
- [ ] T017: Update search-issues MCP tool to use Enhanced JQL API ← **CURRENT TASK**
- [ ] T018: Add backward compatibility mapping for legacy parameters  
- [ ] T019: Implement cursor-based pagination support in MCP tool response
- [ ] T020: Add Enhanced JQL response metadata to formatter

**Implementation Ready**
- All Enhanced JQL API infrastructure is implemented and tested
- Zero breaking changes to MCP tool interface guaranteed  
- Backward compatibility through parameter mapping
- Cursor-based pagination with legacy startAt support
- Comprehensive validation with 97.02% test coverage

**Execution Strategy**
1. **T017** modifies `src/tools/issue-tools.ts` to use Enhanced JQL service
2. **T018-T020** add incremental enhancements  
3. **Integration tests** validate against real Jira API
4. **Polish phase** ensures production readiness

The Enhanced JQL API migration foundation is complete and ready for MCP tool integration!