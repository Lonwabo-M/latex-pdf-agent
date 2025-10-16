// This file tells Vercel that the API functions are in the /api folder
module.exports = (req, res) => {
  res.status(200).json({
    message: 'LaTeX PDF Agent API',
    endpoints: {
      health: '/health',
      generatePdf: '/api/generate-pdf',
      generateMultiPage: '/api/generate-multi-page-pdf'
    }
  });
};
