# Interactive homepage update — 8 October 2026

The marketing homepage now renders independently of backend health. The global red status banner and 15-second polling loop are removed. Analysis workspaces show a quiet availability notice with an explicit retry action; failed submissions still report failures instead of inventing results.

The hero now contains a Canvas 2D signal sculpture with spiral, voice and wave shapes, drag/keyboard rotation, illumination pulses, an energy slider and pause control. Shapes interpolate when animated. Touch supports horizontal rotation while preserving vertical page scrolling. Mobile uses fewer curves; the renderer caps pixel density and frame rate. Hidden/offscreen canvases stop scheduling frames. Reduced-motion settings disable autonomous motion. Moving highlights, animated drawing paths and pointer lighting extend the visual language across the homepage.

## Verification

- Frontend lint and production build passed.
- Existing request timeout/cancellation checks passed.
- Browser: shape changes, slider, pulse, pause, mouse drag, keyboard focus/rotation, mobile navigation and offline analysis notice checked.
- Responsive widths 320 px, 390 px and 1440 px checked; no horizontal document overflow.
- No runtime console errors during interaction checks.
- Model weights, preprocessing, backend and scoring formulas are untouched by this update.
- Compressed JavaScript approximately 142.88 KB (previous 141.06 KB).

This is a frontend update. It does not resolve the Render free-instance memory limit. Vercel and Render deploy new commits automatically only when their Git integration, watched branch and auto-deploy settings are enabled; successful Git push alone does not confirm successful deployment.
