#!/usr/bin/env node

/**
 * Test script to validate the feed summarizer with mock data
 * Usage: node test/test-with-mock-data.js
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock articles data
const mockArticles = [
  {
    title: 'The Future of AI in Software Development',
    author: 'Jane Doe',
    source_url: 'https://example.com/ai-dev',
    published_date: '2024-01-15',
    summary: 'An exploration of how artificial intelligence is transforming the way we write and maintain code.',
  },
  {
    title: 'Understanding Distributed Systems',
    author: 'John Smith',
    source_url: 'https://example.com/distributed',
    published_date: '2024-01-14',
    summary: 'A deep dive into the principles and challenges of building distributed systems at scale.',
  },
  {
    title: 'Climate Change and Technology Solutions',
    author: 'Alice Johnson',
    source_url: 'https://example.com/climate',
    published_date: '2024-01-13',
    summary: 'How modern technology can help address the climate crisis through innovative solutions.',
  },
];

// Mock analysis data
const mockAnalysis = {
  articleSummaries: [
    {
      title: 'The Future of AI in Software Development',
      summary: 'This article explores the transformative impact of AI on software development, discussing tools like GitHub Copilot and how they enhance developer productivity while raising questions about code quality and maintenance.',
    },
    {
      title: 'Understanding Distributed Systems',
      summary: 'A comprehensive guide to distributed systems covering consensus algorithms, fault tolerance, and scalability patterns. The article provides practical insights for building robust distributed applications.',
    },
    {
      title: 'Climate Change and Technology Solutions',
      summary: 'This piece examines technological innovations aimed at combating climate change, including renewable energy systems, carbon capture technologies, and AI-driven climate modeling.',
    },
  ],
  trends: [
    'Focus on emerging technologies (AI, distributed systems)',
    'Interest in practical applications of technology',
    'Concern for global challenges and their technological solutions',
    'Emphasis on scalability and robustness in software systems',
  ],
  overallInsight: 'The reading pattern shows a strong interest in cutting-edge technology with practical applications. There\'s a balance between deep technical topics (distributed systems, AI) and broader societal concerns (climate change). This suggests a reader who values both technical excellence and social responsibility, looking for ways technology can solve real-world problems.',
};

/**
 * Generate HTML for a daily page (simplified version)
 */
function generateTestHTML(date, articles, analysis) {
  const dateStr = date.toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed Summary - ${dateStr} (Test)</title>
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
        .badge {
            display: inline-block;
            background: #e74c3c;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: 10px;
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
        <h1>Daily Feed Summary <span class="badge">TEST</span></h1>
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
            Generated by Feed Summarizer (TEST MODE) • Powered by Readwise Reader & Claude AI
        </footer>
    </div>
</body>
</html>`;
}

async function main() {
  console.log('🧪 Running test with mock data...\n');

  // Generate test HTML
  const today = new Date();
  const testHTML = generateTestHTML(today, mockArticles, mockAnalysis);

  // Write to tmpdir so it doesn't get committed
  const testPath = join(tmpdir(), 'test-feed-summary.html');
  writeFileSync(testPath, testHTML);

  console.log('✅ Test completed successfully!\n');
  console.log(`Generated test HTML file: ${testPath}`);
  console.log(`\nYou can open this file in a browser to see how the output looks:\n`);
  console.log(`  file://${testPath}\n`);
  console.log('📊 Mock Analysis Summary:');
  console.log(`  - Articles: ${mockArticles.length}`);
  console.log(`  - Trends: ${mockAnalysis.trends.length}`);
  console.log(`  - Overall Insight: ${mockAnalysis.overallInsight.substring(0, 80)}...`);
}

main();
