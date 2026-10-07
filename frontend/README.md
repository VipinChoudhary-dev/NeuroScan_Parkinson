# NeuroScan frontend

React 19 + Vite. Run `npm ci`, then `npm run dev` from this directory, with the Python backend running on port 8000. See the root README for the complete setup, evaluations and model limitations.

- `npm run lint`: ESLint and React Hooks checks.
- `npm run build`: production assets in `dist/`.
- `VITE_API_BASE_URL`: optional backend URL override in `.env`.

Result scores represent model confidence in a predicted class, not a person’s disease probability. Backend errors appear inline, unavailable models produce a banner, and unexpected React errors have a visible recovery page.
