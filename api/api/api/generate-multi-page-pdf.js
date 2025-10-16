const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      landscape: options.orientation === 'landscape',
      printBackground: true,
    };

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
};
