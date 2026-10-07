# Hosting NeuroScan

The application is prepared for a frontend + Python backend deployment. It has not been published by this change. The classifiers require their model artifacts and a compatible Python/TensorFlow environment; static hosting alone cannot run them.

## Frontend

Run `npm --prefix frontend ci` then `npm --prefix frontend run build`. Serve `frontend/dist` with SPA fallback to `index.html`. Production API calls default to `/api`, so configure the hosting reverse proxy to forward `/api/*` to FastAPI with the `/api` prefix stripped. Or set `VITE_API_BASE_URL=https://your-api-host` at build time and rebuild.

Use HTTPS. Browser microphone capture requires a secure context (localhost is allowed for development). Keep the frontend and API origins explicit; configure `ALLOWED_ORIGINS` on the backend for a separately hosted client. Do not serve the project root, datasets, reports, virtual environment or backend directory as public static files.

## Backend

Install `backend/requirements.txt`, preserve the existing `models` artifacts and start `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000` behind a production HTTPS reverse proxy. Do not use `--reload` publicly. Verify `/health` before exposing the app. Public demo downloads require the numbered `test_samples` files; evidence experiments require their JSON reports. The core predictions do not need the full training datasets.

The saved voice objects require matching scikit-learn versions. Check the TensorFlow platform/runtime on the hosting machine; this repository was exercised on Apple Silicon Python 3.13. A compatible server build must be verified independently. Provision memory for the loaded models.

## Medical assistant

Copy `backend/.env.example` to `backend/.env` for local use, or use the host's secret manager/environment settings. Set:

- `GEMINI_API_KEY`: server-side only; never a `VITE_` variable.
- `GEMINI_PROVIDER=gemini` for Google AI Studio, or `vertex` for Vertex Express Mode.
- `GEMINI_MODEL`: an enabled model supported by the account; default `gemini-3.5-flash-lite`.

The provider API must be enabled and its billing/quota/access configured in the Google project. Restart the backend after changing environment variables. `/assistant/status` reports configuration presence only, not a successful live credential check. Provider failures are shown clearly without fabricated AI replies or exposing credentials.

A credential pasted into a conversation should be rotated before deployment. `.env` is excluded from Git and backups created for this upgrade. Never copy it to `frontend/public` or include it in screenshots, logs or client JavaScript.

A short notice above Send explains that sending shares the message and recent conversation with Google. Sending is the affirmative action; there is no repeated checkbox. The backend does not attach uploads, predictions or identity data. Chat is kept only in page memory; Google processing is governed by the chosen API/service terms. Do not claim that AI conversations remain local. The response references are a curated reading list, not live search citations.

Basic per-process limits allow eight requests/minute per client and 120/hour globally, with three concurrent provider calls, bounded input/output and timeouts. Before public exposure, configure an edge/gateway rate limit and appropriate budget/quota controls: in-memory limits reset on restart and are not shared across workers. Trust forwarded client IPs only from your reverse proxy. Set proxy upload/body limits consistent with the application (25 MB voice, 12 MB per image; bound multipart/request bodies globally as well). Do not log request bodies or provider credentials. Chat safety instructions are not a guarantee of correctness; review responses in the intended deployment setting.

## Scope

This remains an unvalidated research application. Public hosting does not make it a diagnostic medical device. Deploy only with accurate limitations, privacy information and appropriate oversight for its actual intended use. No authentication, medical-record system or clinical certification is supplied by this repository.
