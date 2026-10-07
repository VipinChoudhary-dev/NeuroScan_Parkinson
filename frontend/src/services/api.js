const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api')).replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the service. Please try again shortly.', { cause: error });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `Analysis failed (${response.status}). Please try again.`);
  return body;
}

function upload(path, file, filename) {
  const form = new FormData();
  form.append('file', file, filename || file.name || 'recording.wav');
  return request(path, { method: 'POST', body: form });
}

export const predictVoice = (file, filename) => upload('/predict/voice', file, filename);
export const predictDrawing = file => upload('/predict/drawing', file);
export const predictWave = file => upload('/predict/wave', file);
export const healthCheck = () => request('/');
export const modelInfo = () => request('/models');

export const fetchEvidence = () => request('/evidence');
export const createAssessment = form => request('/assessments', { method: 'POST', body: form });
export async function fetchDemoSample(kind, label = 'healthy', number = 1) {
  const response = await fetch(`${API_BASE}/demo-samples/${kind}/${label}/${number}`);
  if (!response.ok) throw new Error('Could not load the bundled demonstration files. Check the backend.');
  const blob = await response.blob();
  return new File([blob], `${label}_${kind}_${number}.${kind === 'voice' ? 'wav' : 'png'}`, { type: blob.type });
}

export const assistantStatus = () => request('/assistant/status');
export const askAssistant = (messages, signal) => request('/assistant/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, consent: true }), signal,
});
