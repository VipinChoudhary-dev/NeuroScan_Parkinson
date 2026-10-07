// Exercise the API helper without a browser or a running provider.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../frontend/src/services/api.js', import.meta.url), 'utf8'))
  .replaceAll('import.meta.env', '({ DEV: false })') + '\nexport { request };';
const { request } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
  assert.deepEqual(await request('/health', { timeoutMs: 100 }), { ok: true });
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Another analysis is in progress.' }), { status: 503 });
  await assert.rejects(request('/predict/voice'), /in progress/);
  globalThis.fetch = async () => new Response('<html>Starting</html>');
  await assert.rejects(request('/evidence'), /valid response/);
  let calls = 0;
  globalThis.fetch = async (_url, { signal }) => {
    calls++;
    return { text: () => new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }) };
  };
  await assert.rejects(request('/assessments', { method: 'POST', timeoutMs: 20 }), /did not respond in time/);
  assert.equal(calls, 1, 'A timed-out POST must not be retried automatically');
  const controller = new AbortController();
  const pending = request('/assistant/chat', { signal: controller.signal, timeoutMs: 100 });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  console.log('PASS: success, HTTP failure, invalid body, body timeout, no POST retry, user cancellation.');
} finally {
  globalThis.fetch = originalFetch;
}
