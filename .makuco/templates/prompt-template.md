# [PROMPT TITLE]

Implement the execution plan below for the **[AREA / LAYER / MODULE]** of the **[PROJECT_NAME]** project.

**Root Repository**: `[ROOT_REPOSITORY_PATH]`

**Attention**: `[IMPORTANT_NOTE_ABOUT_PATHS_NAMES_LIMITS_OR_ASSUMPTIONS]`

---

# Execution Plan — [FEATURE_NAME]

**Generated on**: `[YYYY-MM-DD]`
**Planner**: `[PLANNER_NAME]`
**Feature Branch**: `[FEATURE_BRANCH]`
**Spec Path**: `[SPEC_FILE_PATH]`
**Part**: **[PART_INDEX] of [TOTAL_PARTS] — [PART_NAME]**

---

## Context *(mandatory)*

Implement **[HIGH_LEVEL_GOAL]**.

This scope should consider:

* **Target Project / Module**: `[TARGET_MODULE_OR_PACKAGE]`
* **Main Stack**: `[MAIN_STACK]`
* **Expected Architecture Pattern**: `[ARCHITECTURE_PATTERN]`
* **Relevant Technical Constraints**: `[TECHNICAL_CONSTRAINTS]`
* **Mandatory Helpers / Abstractions / Utilities**: `[MANDATORY_HELPERS_OR_ABSTRACTIONS]`
* **Internal References to Follow**: `[REFERENCE_FILES_OR_DOMAINS]`

### Implementation Intent

The implementation should:

* follow the existing patterns in the repository
* reuse existing code and abstractions before introducing new solutions
* preserve compatibility with the current architecture
* maintain consistency with naming, folder structure, domain conventions, and implementation style already adopted in the project

---

## Ubiquitous Language *(include when feature involves business/domain terms)*

| Business Term       | Code / Table / Enum / Object |
| ------------------- | ---------------------------- |
| `[BUSINESS_TERM_1]` | `[CODE_EQUIVALENT_1]`        |
| `[BUSINESS_TERM_2]` | `[CODE_EQUIVALENT_2]`        |
| `[BUSINESS_TERM_3]` | `[CODE_EQUIVALENT_3]`        |
| `[BUSINESS_TERM_4]` | `[CODE_EQUIVALENT_4]`        |

> List only terms that are truly relevant to the feature.

---

## Files to Create *(mandatory when new files are required)*

```txt
[BASE_PATH]/
├── [FILE_OR_DIRECTORY_1]
├── [FILE_OR_DIRECTORY_2]
├── [FILE_OR_DIRECTORY_3]
└── [FILE_OR_DIRECTORY_N]
```

> Include only files that must be created in this delivery.

---

## Files to Modify *(mandatory when existing files are affected)*

* `[EXISTING_FILE_PATH_1]` → `[CHANGE_SUMMARY_1]`
* `[EXISTING_FILE_PATH_2]` → `[CHANGE_SUMMARY_2]`
* `[EXISTING_FILE_PATH_3]` → `[CHANGE_SUMMARY_3]`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [PRIMARY_USER_JOURNEY_TITLE] (Priority: P1)

[Describe the primary journey in business language.]

**Why this priority**: [Explain why this is the highest value delivery.]

**Independent Test**: [Describe how to validate this journey in isolation.]

**Acceptance Scenarios**:

1. **Given** [INITIAL_STATE], **When** [ACTION], **Then** [EXPECTED_OUTCOME]
2. **Given** [INITIAL_STATE], **When** [ACTION], **Then** [EXPECTED_OUTCOME]

---

### User Story 2 - [SECONDARY_USER_JOURNEY_TITLE] (Priority: P2)

[Describe a secondary independent journey.]

**Why this priority**: [Justify the priority.]

**Independent Test**: [Describe how to test in isolation.]

**Acceptance Scenarios**:

1. **Given** [INITIAL_STATE], **When** [ACTION], **Then** [EXPECTED_OUTCOME]

---

### User Story 3 - [TERTIARY_USER_JOURNEY_TITLE] (Priority: P3)

[Describe a tertiary journey or refinement.]

**Why this priority**: [Justify the priority.]

**Independent Test**: [Describe how to test in isolation.]

**Acceptance Scenarios**:

1. **Given** [INITIAL_STATE], **When** [ACTION], **Then** [EXPECTED_OUTCOME]

<!--
    ACTION REQUIRED: Add more user stories as needed, each with a clear priority and independent testability.
-->

---

## Edge Cases *(mandatory)*

* [EDGE_CASE_1]
* [EDGE_CASE_2]
* [EDGE_CASE_3]
* [ERROR_OR_BOUNDARY_CONDITION_4]

---

## Requirements *(mandatory)*

### Functional Requirements

* **FR-001**: System MUST [CORE_CAPABILITY_1]
* **FR-002**: System MUST [CORE_CAPABILITY_2]
* **FR-003**: System MUST [CORE_CAPABILITY_3]
* **FR-004**: System MUST [DATA_OR_VALIDATION_REQUIREMENT]
* **FR-005**: System MUST [AUTHORIZATION_OR_SECURITY_REQUIREMENT]
* **FR-006**: System MUST [TRANSACTIONAL_OR_CONSISTENCY_REQUIREMENT]
* **FR-007**: System MUST [API_OR_INTERFACE_REQUIREMENT]
* **FR-008**: System MUST [ERROR_HANDLING_REQUIREMENT]
* **FR-009**: System MUST [TESTING_REQUIREMENT]
* **FR-010**: System MUST [DOCUMENTATION_OR_CONTRACT_REQUIREMENT]

> Add as many requirements as needed.
> Use clear, verifiable, and behavior-oriented requirements.

### Key Entities *(include if feature involves data)*

* **[ENTITY_1]**: [Conceptual description of the entity and its role in the domain]
* **[ENTITY_2]**: [Conceptual description of the entity and its relationships]
* **[ENTITY_3]**: [Conceptual description of the entity and relevant constraints]

---

## Implementation Steps *(mandatory)*

### 1. [STEP_TITLE]

**File**: `[TARGET_FILE_PATH]`
**Type**: `[Migration | Model | Controller | Service | Validator | Route | Test | Swagger | Permission | Other]`

**Objective**: [Clearly describe the objective of this step.]

**Implementation Instructions**:

* [INSTRUCTION_1]
* [INSTRUCTION_2]
* [INSTRUCTION_3]

**Reference Pattern**:

* `[REFERENCE_FILE_OR_MODULE_1]`
* `[REFERENCE_FILE_OR_MODULE_2]`

**Expected Outcome**:

* [OUTCOME_1]
* [OUTCOME_2]

---

### 2. [STEP_TITLE]

**File**: `[TARGET_FILE_PATH]`
**Type**: `[STEP_TYPE]`

**Objective**: [Clearly describe the objective of this step.]

**Implementation Instructions**:

* [INSTRUCTION_1]
* [INSTRUCTION_2]
* [INSTRUCTION_3]

**Reference Pattern**:

* `[REFERENCE_FILE_OR_MODULE]`

**Expected Outcome**:

* [OUTCOME_1]
* [OUTCOME_2]

---

### 3. [STEP_TITLE]

**File**: `[TARGET_FILE_PATH]`
**Type**: `[STEP_TYPE]`

**Objective**: [Clearly describe the objective of this step.]

**Implementation Instructions**:

* [INSTRUCTION_1]
* [INSTRUCTION_2]
* [INSTRUCTION_3]

**Reference Pattern**:

* `[REFERENCE_FILE_OR_MODULE]`

**Expected Outcome**:

* [OUTCOME_1]
* [OUTCOME_2]

<!--
    ACTION REQUIRED: Add as many implementation steps as needed to cover the full scope of the feature.
    Each step should have a clear objective, detailed instructions, reference patterns, and expected outcomes.
-->

---

## Validation Strategy *(recommended)*

### Validation Rules

* [VALIDATION_RULE_1] - [Describe the rule and how to validate it.]
* [VALIDATION_RULE_2] - [Describe the rule and how to validate it.]
* [VALIDATION_RULE_3] - [Describe the rule and how to validate it.]

<!--
    ACTION REQUIRED: Define clear validation rules that can be used to verify the correctness and completeness of the implementation.
    These rules should be specific, measurable, and directly related to the requirements and expected outcomes defined above.

    Example:

    * EMAIL_FORMAT_VALIDATION - Ensure that all email fields accept only valid email formats, and that invalid formats are rejected with appropriate error messages.
    * CPF_UNIQUENESS_VALIDATION - Ensure that the CPF field is unique across the database, and that attempts to create or update a record with a duplicate CPF are rejected with a clear error message.
-->

### Test Cases

* [TEST_CASE_1]
* [TEST_CASE_2]
* [TEST_CASE_3]
* [TEST_CASE_4]

---

## Authorization & Access Rules *(include when applicable)*

* **Actor**: `[ROLE_OR_PROFILE]`
* **Scope Rule**: `[TENANCY_OR_OWNERSHIP_RULE]`
* **Allowed Actions**: `[CREATE / UPDATE / READ / FIND / DELETE / ...]`
* **Restrictions**: `[FIELD_RESTRICTIONS_OR_DOMAIN_LIMITS]`

> Clearly define the authorization rules for this feature, including any role-based access control, ownership rules, and field-level restrictions.

---

## API / Contract Notes *(include when applicable)*

* **Endpoint Base**: `[API_BASE_PATH]`
* **Input Contract**: `[REQUEST_STRUCTURE_SUMMARY]`
* **Output Contract**: `[RESPONSE_STRUCTURE_SUMMARY]`
* **Error Contract**: `[ERROR_CODES_OR_DOMAIN_ERRORS]`
* **Documentation Requirement**: `[SWAGGER_OPENAPI_OR_OTHER_CONTRACT_DOCS]`

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

* **SC-001**: [PRIMARY_FLOW_CAN_BE_COMPLETED_SUCCESSFULLY]
* **SC-002**: [BUSINESS_RULES_ARE_ENFORCED_CONSISTENTLY]
* **SC-003**: [AUTHORIZATION_SCOPE_IS_RESPECTED]
* **SC-004**: [TESTS_COVER_MAIN_SCENARIOS_AND_EDGE_CASES]
* **SC-005**: [API_CONTRACT_AND_DOCUMENTATION_ARE_UPDATED]

---

## Final Considerations *(mandatory)*

<!--
    ACTION REQUIRED: Ensure the implementation adheres to the following guidelines.
    These are critical for maintaining code quality, consistency, and architectural integrity.
-->

* The implementation must strictly follow the existing standards in the repository.
* Do not introduce new abstractions if an equivalent pattern already exists in the project.
* Reuse helpers, services, validators, factories, callbacks, and conventions already adopted.
* Always respect transactional consistency when multiple entities are modified in the same operation.
* In destructive operations, explicitly state whether the expected behavior is soft delete, hard delete, logical unlinking, or external resource cleanup.
* Preserve data isolation, authorization rules, relational integrity, and compatibility with the current architecture.
* Update tests, technical documentation, and API contracts when applicable.
* In case of ambiguity, prioritize the existing pattern in the domain closest to this feature.