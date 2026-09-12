# Feed Summarizer

A daily GitHub action that fetches and summarizes articles from Readwise Reader API using Claude AI.

## Features

- 📚 Fetches articles saved in the last 24 hours from Readwise Reader
- 🤖 Summarizes articles using Claude SDK (Claude 3.5 Sonnet)
- 📊 Extracts trends from your reading
- 🌐 Generates a static HTML site with daily pages
- ⏰ Runs automatically every day at midnight UTC
- 🚀 Deploys to GitHub Pages automatically

## Setup

### 1. Fork or Clone This Repository

```bash
git clone https://github.com/your-username/feed.git
cd feed
```

### 2. Install Dependencies (for local development)

```bash
npm install
```

### 3. Configure GitHub Secrets

Go to your repository settings → Secrets and variables → Actions, and add:

**Required Secrets:**

1. **`READWISE_TOKEN`** - Your Readwise Reader API token
   - Get it from: https://readwise.io/access_token
   
2. **`ANTHROPIC_API_KEY`** - Your Anthropic API key for Claude
   - Get it from: https://console.anthropic.com/

### 4. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Set Source to "GitHub Actions"
3. Save

### 5. Run the Workflow

The workflow will run automatically every day at midnight UTC. You can also:
- Trigger it manually from the Actions tab
- View workflow runs and logs in the Actions tab

## How It Works

1. **Fetch**: The action fetches articles saved to Readwise Reader in the last 24 hours
2. **Analyze**: Claude AI analyzes the articles to:
   - Generate brief summaries (2-3 sentences each)
   - Identify key trends and themes
   - Provide overall insights about reading patterns
3. **Generate**: Creates a beautiful HTML page for the day with:
   - Article summaries with links
   - Trend analysis
   - Reading insights
4. **Deploy**: Automatically deploys to GitHub Pages
5. **Update**: Updates the index page with links to all daily summaries

## Local Development

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys
# Then run the fetcher
npm run fetch

# Run tests with mock data
npm test

# Check JavaScript syntax
npm run test:syntax
```

## Project Structure

```
feed/
├── .github/
│   └── workflows/
│       └── daily-feed.yml    # GitHub Actions workflow
├── docs/                      # Generated HTML files (GitHub Pages)
│   ├── index.html            # Main index page
│   └── YYYY-MM-DD.html       # Daily summary pages
├── src/
│   └── index.js              # Main application script
├── test/
│   └── test-with-mock-data.js # Test with mock data
├── .env.example              # Example environment variables
├── .gitignore
├── package.json
└── README.md
```

## Output

The action generates:
- **`docs/index.html`** - Main page with a list of all days
- **`docs/YYYY-MM-DD.html`** - Individual page for each day with:
  - Number of articles saved
  - Overall insights about your reading
  - Key trends identified by Claude
  - Summaries of each article with links

## Customization

### Change Schedule

Edit `.github/workflows/daily-feed.yml` to change when the action runs:

```yaml
on:
  schedule:
    - cron: '0 0 * * *'  # Midnight UTC daily
```

### Customize HTML Styling

Edit the CSS in `src/index.js` functions:
- `generateDailyHTML()` - Daily page styling
- `generateIndexHTML()` - Index page styling

### Adjust Article Window

Change the time window in `fetchReadwiseArticles()`:

```javascript
// Fetch from last 24 hours (default)
yesterday.setHours(yesterday.getHours() - 24);

// Change to 48 hours:
yesterday.setHours(yesterday.getHours() - 48);
```

## Troubleshooting

### No articles appearing?
- Check that articles are being saved to Readwise Reader
- Verify your `READWISE_TOKEN` is correct
- Check the Actions logs for errors

### Claude analysis not working?
- Verify your `ANTHROPIC_API_KEY` is valid
- Check you have sufficient API credits
- Review the Actions logs for error messages

### GitHub Pages not deploying?
- Ensure GitHub Pages is enabled in repository settings
- Check that the workflow has completed successfully
- Verify Pages is set to deploy from "GitHub Actions"

## License

MIT

## Credits

- Built with [Readwise Reader API](https://readwise.io/)
- Powered by [Claude AI](https://www.anthropic.com/)
- Deployed on [GitHub Pages](https://pages.github.com/)
