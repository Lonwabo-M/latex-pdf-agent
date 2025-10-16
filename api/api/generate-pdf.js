const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { html, options = {} } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'Missing required field: html' });
    }

    const pdfOptions = {
      format: options.format || 'A4',
      landscape: options.orientation === 'landscape',
      margin: options.margin || {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
    };

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          }
          .katex { font-size: 1.05em; }
          .katex-display { font-size: 1.1em; margin: 1em 0; }
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
};
