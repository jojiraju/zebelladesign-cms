# Zebella admin panel

The admin panel for the Zebella store, built with React, TypeScript and Vite. All data comes from the backend in the separate `zebelladesign-api` repo.

## Local setup

1. Start the API by following the README in `zebelladesign-api`. It loads sample data with `manage.py seed_demo`.
2. Install and run the panel:

```bash
cp .env.example .env
npm install
npm run dev
```

The panel runs at http://localhost:5174 and expects the API at `VITE_API_BASE_URL` (http://localhost:8000 by default).

## Commands

- `npm run dev`: start the development server
- `npm run build`: type-check and build for production
- `npm run lint`: run the linter
- `npm run preview`: serve the production build locally

Deployment is described in `deploy/DEPLOY.md` in the API repo.
