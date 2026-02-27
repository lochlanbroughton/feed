# Feed Summarizer

A daily GitHub action that fetches and summarizes articles from Readwise Reader API using Claude AI.

## Features

- 📚 Fetches articles saved in the last 24 hours from Readwise Reader
- 🤖 Summarizes articles using Claude SDK
- 📊 Extracts trends from your reading
- 🌐 Generates a static HTML site with daily pages

## Setup

### Required Secrets

Configure the following secrets in your GitHub repository:

1. `READWISE_TOKEN` - Your Readwise Reader API token
2. `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude

### Getting API Keys

**Readwise Token:**
1. Go to https://readwise.io/access_token
2. Copy your access token

**Anthropic API Key:**
1. Go to https://console.anthropic.com/
2. Create an API key

## Usage

The GitHub action runs automatically every day at midnight UTC. You can also trigger it manually from the Actions tab.

The generated HTML site is published to GitHub Pages, with each day having its own page.

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export READWISE_TOKEN=your_token_here
export ANTHROPIC_API_KEY=your_key_here

# Run the fetcher
npm run fetch
```

## Output

The action generates:
- `docs/index.html` - Main page with list of all days
- `docs/YYYY-MM-DD.html` - Individual page for each day
