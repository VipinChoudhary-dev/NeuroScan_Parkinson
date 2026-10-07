# Publication verification — 7 October 2026

The GitHub package is a copy; the original working project was not moved or edited.

- Backend suite: 46 passed, 2 skipped because the optional full drawing dataset is not distributed.
- Frontend lint and production build checked after compatible dependency security updates.
- npm audit after those updates: zero reported vulnerabilities at publication time.
- All deployed model files match the original byte for byte.
- Credentials, dependencies, environments, raw training corpora and build output excluded from Git.
- Vercel SPA configuration supplied for the frontend; a separate compatible Python model service is still required.

Linux backend hosting and production deployment are not yet verified. Browser interaction checks from the original project are available as scripts; they were not rerun against this publication copy.
