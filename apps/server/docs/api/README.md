# API Documentation

This directory contains the auto-generated API documentation for the NeoStock platform.

## Structure

- `schemas/` - OpenAPI schema definitions
- `endpoints/` - Detailed endpoint documentation
- `openapi.json` - Generated OpenAPI specification (auto-generated)

## Documentation Generation

The API documentation is automatically generated from tRPC routes using the following process:

1. **Schema Extraction**: tRPC router definitions are analyzed to extract types and procedures
2. **OpenAPI Generation**: @trpc/server integration generates OpenAPI 3.0 specification
3. **Validation**: Documentation consistency is validated against actual endpoints

## Validation Process

The documentation validation includes:

- **Endpoint Coverage**: All tRPC procedures must have corresponding documentation
- **Type Safety**: Schema definitions must match TypeScript interfaces
- **Response Validation**: API responses must conform to documented schemas
- **Coverage Target**: Minimum 95% documentation coverage for production, 80% for development

## Usage

```bash
# Generate API documentation
bun run docs:generate

# Validate documentation
bun run docs:validate

# Serve documentation locally
bun run docs:serve
```

## Integration

This documentation system integrates with:

- **tRPC Router**: Source of truth for API definitions
- **OpenAPI Tools**: Standard API documentation format
- **CI/CD Pipeline**: Automated validation in quality gates
- **Development Workflow**: Real-time validation during development