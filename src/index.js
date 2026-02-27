import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const READWISE_TOKEN = process.env.READWISE_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DOCS_DIR = join(__dirname, '..', 'docs');

// Validate environment variables
if (!READWISE_TOKEN) {
  console.error('Error: READWISE_TOKEN environment variable is required');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * Fetch articles from Readwise Reader API from the last 24 hours
 */
async function fetchReadwiseArticles() {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  const updatedAfter = yesterday.toISOString();

  console.log(`Fetching articles updated after ${updatedAfter}...`);

  const url = `https://readwise.io/api/v3/list/?updatedAfter=${encodeURIComponent(updatedAfter)}&location=archive`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Token ${READWISE_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Readwise API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Found ${data.results?.length || 0} articles`);
  return data.results || [];
}

/**
 * Summarize articles and extract trends using Claude
 */
async function summarizeWithClaude(articles) {
  if (articles.length === 0) {
    return {
      summary: 'No articles were saved in the last 24 hours.',
      trends: [],
      articleSummaries: [],
    };
  }

  // Prepare article data for Claude
  const articlesText = articles.map((article, index) => {
    return `Article ${index + 1}:
Title: ${article.title || 'Untitled'}
Author: ${article.author || 'Unknown'}
URL: ${article.source_url || 'N/A'}
Summary: ${article.summary || article.content?.substring(0, 500) || 'No content available'}
---`;
  }).join('\n\n');

  const prompt = `You are analyzing a collection of articles that were saved to Readwise Reader in the last 24 hours. Here are the articles:

${articlesText}

Please provide:
1. A brief summary of each article (2-3 sentences)
2. Key trends or themes across all the articles
3. Overall insights about what these articles reveal about the reader's interests

Format your response as JSON with the following structure:
{
  "articleSummaries": [
    {
      "title": "article title",
      "summary": "brief summary"
    }
  ],
  "trends": ["trend 1", "trend 2", ...],
  "overallInsight": "overall insight paragraph"
}`;

  console.log('Sending to Claude for analysis...');

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = message.content[0].text;
  console.log('Received response from Claude');

  // Parse JSON response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Failed to parse Claude response as JSON:', error);
  }

  // Fallback if JSON parsing fails
  return {
    summary: responseText,
    trends: [],
    articleSummaries: [],
  };
}

/**
 * Generate HTML for a daily page
 */
function generateDailyHTML(date, articles, analysis) {
  const dateStr = date.toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed Summary - ${dateStr}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .date {
            color: #7f8c8d;
            font-size: 1.1em;
            margin-bottom: 30px;
        }
        .nav {
            margin-bottom: 30px;
        }
        .nav a {
            color: #3498db;
            text-decoration: none;
            margin-right: 15px;
        }
        .nav a:hover {
            text-decoration: underline;
        }
        .section {
            margin-bottom: 40px;
        }
        h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
        }
        .insight {
            background: #ecf9ff;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #3498db;
            margin-bottom: 20px;
        }
        .trends {
            list-style: none;
            padding: 0;
        }
        .trends li {
            background: #f8f9fa;
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 4px;
            border-left: 3px solid #2ecc71;
        }
        .article {
            background: #fafafa;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
        }
        .article h3 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .article h3 a {
            color: #2c3e50;
            text-decoration: none;
        }
        .article h3 a:hover {
            color: #3498db;
        }
        .article .meta {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        .article .summary {
            color: #555;
            line-height: 1.8;
        }
        .stats {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            text-align: center;
        }
        .stats span {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
        }
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="index.html">← Back to All Days</a>
        </div>
        
        <h1>Daily Feed Summary</h1>
        <p class="date">${dateStr}</p>

        <div class="stats">
            <span>${articles.length}</span>
            <p>Articles Saved</p>
        </div>

        ${analysis.overallInsight ? `
        <div class="section">
            <h2>📊 Overall Insights</h2>
            <div class="insight">
                ${analysis.overallInsight}
            </div>
        </div>
        ` : ''}

        ${analysis.trends && analysis.trends.length > 0 ? `
        <div class="section">
            <h2>🔍 Key Trends</h2>
            <ul class="trends">
                ${analysis.trends.map(trend => `<li>${trend}</li>`).join('\n                ')}
            </ul>
        </div>
        ` : ''}

        <div class="section">
            <h2>📚 Articles</h2>
            ${articles.map((article, index) => {
                const summary = analysis.articleSummaries?.[index]?.summary || 'Summary not available';
                return `
            <div class="article">
                <h3>
                    ${article.source_url ? `<a href="${article.source_url}" target="_blank" rel="noopener noreferrer">${article.title || 'Untitled'}</a>` : (article.title || 'Untitled')}
                </h3>
                <div class="meta">
                    ${article.author ? `By ${article.author}` : ''}
                    ${article.published_date ? ` • ${new Date(article.published_date).toLocaleDateString()}` : ''}
                </div>
                <div class="summary">${summary}</div>
            </div>`;
            }).join('\n            ')}
        </div>

        <footer>
            Generated by Feed Summarizer • Powered by Readwise Reader & Claude AI
        </footer>
    </div>
</body>
</html>`;
}

/**
 * Generate the index page listing all days
 */
function generateIndexHTML() {
  // Get all HTML files in docs directory
  const files = readdirSync(DOCS_DIR)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.html$/))
    .sort()
    .reverse(); // Most recent first

  const daysList = files.map(file => {
    const date = file.replace('.html', '');
    return `
            <li class="day-item">
                <a href="${file}">
                    <span class="date">${date}</span>
                    <span class="arrow">→</span>
                </a>
            </li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed Summaries</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 2.5em;
            text-align: center;
        }
        .subtitle {
            text-align: center;
            color: #7f8c8d;
            margin-bottom: 40px;
            font-size: 1.1em;
        }
        .days-list {
            list-style: none;
            padding: 0;
        }
        .day-item {
            margin-bottom: 15px;
        }
        .day-item a {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            background: #f8f9fa;
            border-radius: 8px;
            text-decoration: none;
            color: #2c3e50;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        }
        .day-item a:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
            transform: translateX(5px);
        }
        .day-item .date {
            font-size: 1.2em;
            font-weight: 500;
        }
        .day-item .arrow {
            font-size: 1.5em;
            transition: transform 0.3s ease;
        }
        .day-item a:hover .arrow {
            transform: translateX(5px);
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #7f8c8d;
        }
        .empty-state h2 {
            margin-bottom: 10px;
            color: #95a5a6;
        }
        footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 Feed Summaries</h1>
        <p class="subtitle">Daily summaries of your Readwise articles</p>

        ${files.length > 0 ? `
        <ul class="days-list">
            ${daysList}
        </ul>
        ` : `
        <div class="empty-state">
            <h2>No summaries yet</h2>
            <p>Check back after the first daily run completes.</p>
        </div>
        `}

        <footer>
            Generated by Feed Summarizer • Powered by Readwise Reader & Claude AI
        </footer>
    </div>
</body>
</html>`;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Starting feed summarizer...');

    // Fetch articles from Readwise
    const articles = await fetchReadwiseArticles();

    // Analyze with Claude
    const analysis = await summarizeWithClaude(articles);

    // Generate HTML for today
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const dailyHTML = generateDailyHTML(today, articles, analysis);

    // Write daily page
    const dailyPath = join(DOCS_DIR, `${dateStr}.html`);
    writeFileSync(dailyPath, dailyHTML);
    console.log(`Generated ${dailyPath}`);

    // Generate/update index page
    const indexHTML = generateIndexHTML();
    const indexPath = join(DOCS_DIR, 'index.html');
    writeFileSync(indexPath, indexHTML);
    console.log(`Generated ${indexPath}`);

    console.log('✅ Feed summarizer completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
