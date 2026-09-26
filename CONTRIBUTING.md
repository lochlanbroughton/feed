# Contributing to Feed Summarizer

Thank you for your interest in contributing to Feed Summarizer! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/feed.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js 20 or later
- npm or yarn
- A Readwise Reader account (for testing)
- An Anthropic API key (for testing)

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys in `.env`:
   ```
   READWISE_TOKEN=your_actual_token
   ANTHROPIC_API_KEY=your_actual_key
   ```

### Running Tests

```bash
# Run tests with mock data
npm test

# Check syntax
npm run test:syntax
```

### Testing Locally

```bash
# Run the fetcher (requires valid API keys)
npm run fetch

# Check the generated HTML in docs/
open docs/index.html
```

## Making Changes

### Code Style

- Use ES6+ module syntax (`import`/`export`)
- Use 2 spaces for indentation
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and single-purpose

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Keep the first line under 72 characters
- Add details in the body if needed

Example:
```
Add trend visualization to daily pages

- Add chart.js for trend visualization
- Update HTML template with chart container
- Style charts to match existing design
```

## Pull Request Process

1. Update the README.md if needed
2. Test your changes thoroughly
3. Run `npm test` to ensure tests pass
4. Commit your changes with clear messages
5. Push to your fork
6. Create a Pull Request with:
   - Clear title describing the change
   - Description of what changed and why
   - Any relevant issue numbers

## Ideas for Contributions

- 🎨 Improve HTML/CSS design
- 📊 Add data visualizations
- 🔍 Enhance trend detection algorithms
- 📱 Make the site mobile-responsive
- 🌐 Add internationalization (i18n)
- 📈 Add analytics/stats page
- 🔔 Add notification options
- 📝 Improve documentation
- 🧪 Add more tests
- ⚡ Performance improvements

## Questions?

Feel free to open an issue for any questions or concerns!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
