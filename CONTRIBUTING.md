# Contributing to operator-996

Thank you for your interest in contributing to operator-996! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Kubernetes (minikube or kind for local development)
- Helm 3.12+
- PostgreSQL client tools

### Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/operator-996.git
   cd operator-996
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.dev .env
   ```

4. **Start local services:**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes
- `release/*` - Release preparation

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): subject

body

footer
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(api): add biofeedback metrics endpoint

Implements POST /api/biofeedback for submitting metrics.

Closes #123
```

```
fix(auth): handle expired JWT tokens correctly

Previously expired tokens caused a 500 error instead of 401.
```

## Pull Request Process

1. **Ensure all tests pass:**
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

2. **Update documentation** if needed

3. **Create a pull request** with:
   - Clear title following commit conventions
   - Description of changes
   - Related issue numbers
   - Screenshots for UI changes

4. **Request review** from maintainers

5. **Address feedback** and update PR as needed

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Commits follow conventions
- [ ] Branch is up to date with target

## Coding Standards

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Avoid `any` type

### File Structure

```
src/
├── config/         # Configuration management
├── routes/         # Express routes
├── middleware/     # Express middleware
├── services/       # Business logic
├── db/             # Database clients
├── utils/          # Utility functions
└── types/          # TypeScript types
```

### Code Style

- Use ESLint and Prettier configurations
- Maximum line length: 100 characters
- Use single quotes for strings
- Use trailing commas

### Error Handling

- Use custom error classes
- Always catch and handle errors
- Log errors with context
- Return appropriate HTTP status codes

## Testing Guidelines

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/            # End-to-end tests
```

### Writing Tests

- Test file naming: `*.test.ts`
- Use descriptive test names
- One assertion per test when possible
- Use mocks for external dependencies

### Running Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage
```

### Coverage Requirements

- Minimum 70% code coverage
- Critical paths: 100% coverage

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Document complex logic inline
- Keep README up to date

### API Documentation

Document all API endpoints with:
- HTTP method and path
- Request body/params
- Response format
- Error codes

## Questions?

If you have questions, please:
1. Check existing issues and discussions
2. Create a new issue with the question label
3. Join our community chat

Thank you for contributing to operator-996! 🚀
