const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'latex-pdf-agent' });
});

/**
 * Main PDF generation endpoint
 */
app.post('/api/generate-pdf', async (req, res) => {
  let browser = null;
  
  try {
    const { html, options = {} } = req.body;

    if (!html) {
      return res.status(400).json({ 
        error: 'Missing required field: html' 
      });
    }

    const pdfOptions = {
      format: options.format || 'A4',
      orientation: options.orientation || 'portrait',
      margin: options.margin || {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: false,
    };

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" 
              integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" 
              crossorigin="anonymous">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          .katex { font-size: 1.05em; }
          .katex-display { font-size: 1.1em; margin: 1em 0; }
          .page-break { page-break-after: always; }
          .avoid-break { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        ${html}
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" 
                integrity="sha384-XjKyOOlVwcGFnYCjpxdxCJiEu+AVHqnCxf8/uUOzMY2Qo2AH0+fpcGavD62pTAmz" 
                crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" 
                integrity="sha384-+VBxd3r6XgURPl3key1J56HPvjNWmaM8vanysM+r/_i5stD1/5fFpY/5/P3e2s6E" 
                crossorigin="anonymous"></script>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            renderMathInElement(document.body, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\\\[', right: '\\\\]', display: true },
                { left: '\\\\(', right: '\\\\)', display: false }
              ],
              throwOnError: false
            });
            window.latexRenderComplete = true;
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(fullHtml, {
      waitUntil: ['networkidle0', 'domcontentloaded']
    });

    await page.waitForFunction(() => window.latexRenderComplete === true, {
      timeout: 10000
    });

    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf(pdfOptions);

    const filename = options.filename || 'document.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * Multi-page PDF generation endpoint
 */
app.post('/api/generate-multi-page-pdf', async (req, res) => {
  let browser = null;
  
  try {
    const { pages, options = {} } = req.body;

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid required field: pages' 
      });
    }

    const pdfOptions = {
      format: options.format || 'A4',
      orientation: options.orientation || 'landscape',
      printBackground: true,
      preferCSSPageSize: false,
    };

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    const combinedHtml = pages.map((pageHtml, index) => `
      <div class="page-content" style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
        ${pageHtml}
      </div>
      ${index < pages.length - 1 ? '<div class="page-break"></div>' : ''}
    `).join('\n');

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { margin: 0; padding: 0; }
          .page-break { page-break-after: always; }
          .page-content { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        ${combinedHtml}
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            renderMathInElement(document.body, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\\\[', right: '\\\\]', display: true },
                { left: '\\\\(', right: '\\\\)', display: false }
              ],
              throwOnError: false
            });
            window.latexRenderComplete = true;
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(fullHtml, { waitUntil: ['networkidle0', 'domcontentloaded'] });
    await page.waitForFunction(() => window.latexRenderComplete === true, { timeout: 10000 });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf(pdfOptions);

    const filename = options.filename || 'slides.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Multi-page PDF Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate multi-page PDF',
      message: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`LaTeX PDF Agent running on port ${PORT}`);
});

module.exports = app;
