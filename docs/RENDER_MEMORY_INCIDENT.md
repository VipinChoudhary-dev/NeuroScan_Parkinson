# Render memory incident — 8 October 2026

Render’s service notification confirms a memory-limit restart at 00:37. The 512 MB instance cannot reliably accommodate the current backend. The deployed frontend bundle contains the correct backend URL. Direct health/evidence requests timed out during investigation. CUDA messages were followed by successful server startup; they do not establish the cause of the analysis failure.

## Memory experiment

On Apple Silicon, the original backend peaked at 469 MiB on loading, 486 MiB after drawing analysis, and 625 MiB after voice analysis. A separate process with NUMBA_DISABLE_JIT=1 and single-thread TF/BLAS settings still peaked at 585 MiB. Linux measurements can differ. This experiment did not demonstrate a safe fit into 512 MB; its runtime settings were not deployed.

## Changes

- Analysis requests now time out after 120 seconds; health/evidence after 45 seconds; chatbot after 55 seconds. Slow restarts produce an explicit error instead of indefinite waiting. Timeout means no result was received, not that the server necessarily stopped processing it.
- Requests also bound response-body reads, validate JSON, and preserve user cancellation. Analysis POSTs are never retried automatically.
- A re-entrant lock admits one analysis per backend worker; overlapping requests receive 503 with Retry-After. Run one Uvicorn worker to avoid duplicating loaded models.
- Analysis start/finish timing is logged without upload content or filenames.
- Model weights, scaler, preprocessing and quality calculations are unchanged. No retraining, quantization or inference-runtime replacement was applied.

## Verification and remaining limit

49 backend tests passed locally, including all 60 original drawing test images. In the publication copy, 47 passed and 2 optional corpus tests skipped. Frontend lint/build and request timeout/cancellation checks passed. Deployed model hashes and feature/quality source match the previous Git commit.

These safeguards do not solve the per-request memory requirement. No safe 512 MB deployment or universal accuracy guarantee for a replacement runtime has been established. Use the original localhost application for a presentation, or verify the same application on a backend with more RAM. Keep-alive cron jobs do not fix memory-limit restarts.
