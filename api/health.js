module.exports = async (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'latex-pdf-agent',
    timestamp: new Date().toISOString()
  });
};
