// index.js
// Minimal entry to satisfy Vercel
export default function handler(req, res) {
  res.status(200).json({ status: 'ok', message: 'Root reachable' });
}
