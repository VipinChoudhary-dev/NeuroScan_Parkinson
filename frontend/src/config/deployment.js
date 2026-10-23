export const IS_PUBLIC_PREVIEW = import.meta.env.PROD
  && import.meta.env.VITE_PUBLIC_DEMO !== 'false';

export const PUBLIC_ANALYSIS_MESSAGE = 'Sorry — the NeuroScan analysis server is taking a nap and won’t work on the public site for now. 😅';
