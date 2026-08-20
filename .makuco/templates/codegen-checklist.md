# Makuco Codegen Checklist: [PROMPT_NAME]

**Purpose**: [Briefly describe the purpose of this checklist and how it should be used to evaluate the quality of the code generation process.]
**Created**: [DATE]
**Feature**: [spec.md](../spec.md)
**Prompt Plan**: [NUMBER_plan_makuco_TIMESTAMP.md] ([LINK_TO_PROMPT_PLAN])

## Quality Tools

- [] Run linters and compilers available in the project to ensure the generated code is free of errors and follows the project's standards.
- [] Run tests to ensure all implemented code is covered and all tests are passing successfully.
- [] Run complexity check in MCP, if available, to ensure the generated code does not exceed the project's complexity standards.
- [] Run SonarQube analysis using the Makuco MCP tools, if applicable, to ensure that the generated code meets the project's quality standards and does not introduce new issues.

## Code Quality

- [] Code follows the project's existing patterns and best practices.
- [] Code is free of linting and compiler errors.
- [] Code is readable and maintainable, with clear naming conventions and structure.
- [] Zero new issues introduced in SonarQube analysis (if applicable).
- [] No code duplication introduced (DRY principle).
- [] No GOD classes, methods or files introduced.
- [] Code is properly tested, with all tests passing and at least 80% of coverage.

## Security Check

- [] No new vulnerabilities introduced in SonarQube analysis.
- [] All inputs are validated at system boundaries to prevent injection attacks and ensure data integrity.
- [] No security hotspots introduced in SonarQube analysis.
- [] Code does not contain any known security anti-patterns (e.g., hardcoded secrets, unsafe deserialization, etc.).
- [] Code follows secure coding practices as defined by the project and industry standards.
- [] No security vulnerabilities introduced (e.g., injection, XSS, SSRF, etc.)

## Implementation Completeness

- [] All steps in the execution plan have been implemented as specified.
- [] All necessary files have been created and properly structured.
- [] All referenced code patterns and best practices have been followed.
- [] All validation rules have been implemented and passed successfully.

## Testing and Validation

- [] All implemented code is covered by tests, including edge cases.
- [] All tests are passing successfully.
- [] SonarQube analysis shows no new issues introduced by the generated code (if applicable).
- [] Tests cover expected behavior and edge cases, ensuring the implementation is robust and reliable, covering validation rules defined in the prompt plan.

## Notes

- [Add any additional notes or comments about the code generation process here.]
