const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api')).replace(/\/$/, '');

// Bound both response headers and body reads. Never retry an analysis POST automatically.
async function request(path, options = {}) {
  const { signal: callerSignal, timeoutMs = path === '/assessments' || path.startsWith('/predict/') ? 120000 : 45000, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (callerSignal?.aborted) cancel();
  callerSignal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...fetchOptions, signal: controller.signal });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); }
    catch (error) {
      throw new Error('The analysis service did not return a valid response. It may be starting or restarting. Please try again after it is ready.', { cause: error });
    }
    if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `Analysis failed (${response.status}). Please try again.`);
    return body;
  } catch (error) {
    if (timedOut) throw new Error('The analysis service did not respond in time. It may be starting, restarting, or overloaded. Your result was not received. Please try again once the service is ready.', { cause: error });
    if (callerSignal?.aborted) throw error;
    if (error instanceof TypeError) throw new Error('Cannot reach the service. Please try again shortly.', { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', cancel);
  }
}

function upload(path, file, filename) {
  const form = new FormData();
  form.append('file', file, filename || file.name || 'recording.wav');
  return request(path, { method: 'POST', body: form });
}

export const predictVoice = (file, filename) => upload('/predict/voice', file, filename);
export const predictDrawing = file => upload('/predict/drawing', file);
export const predictWave = file => upload('/predict/wave', file);
export const healthCheck = () => request('/health');
export const modelInfo = () => request('/models');

export const fetchEvidence = () => request('/evidence');
export const createAssessment = form => request('/assessments', { method: 'POST', body: form });
export async function fetchDemoSample(kind, label = 'healthy', number = 1) {
  let blob;
  try {
    const response = await fetch(`${API_BASE}/demo-samples/${kind}/${label}/${number}`, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error('Could not load the demonstration files. Check the backend.');
    blob = await response.blob();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The service is taking too long to load demonstration files. Please try again once it is ready.', { cause: error });
    throw error;
  }
  return new File([blob], `${label}_${kind}_${number}.${kind === 'voice' ? 'wav' : 'png'}`, { type: blob.type });
}

export const assistantStatus = () => request('/assistant/status');
export const askAssistant = (messages, signal) => request('/assistant/chat', {
  method: 'POST', timeoutMs: 55000, headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, consent: true }), signal,
});
