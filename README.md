# LaTeX PDF Rendering Agent

A microservice that renders HTML with LaTeX notation into PDFs with beautifully formatted mathematical equations.

## Endpoints

- `GET /health` - Health check
- `POST /api/generate-pdf` - Generate single-page PDF
- `POST /api/generate-multi-page-pdf` - Generate multi-page PDF

## Running Locally
```bash
npm install
npm start
```

Service will run on http://localhost:3001
