# LavaLust Lab 6 React Frontend

Brown minimalist React interface for the authenticated product CRUD API.

## Local development

1. Copy `.env.example` to `.env`.
2. Make sure the LavaLust backend is available at the configured URL.
3. Install and start the app:

```bash
npm install
npm run dev
```

The default frontend URL is `http://localhost:5173`.

## Render static-site settings

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://fesalbon-wrysha-mae.onrender.com/api`

Add the deployed static-site origin to the backend's `FRONTEND_ORIGIN` environment variable. Do not place Aiven credentials in this frontend; all database access goes through the LavaLust API.
