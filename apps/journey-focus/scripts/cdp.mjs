import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function connectPage({ fresh = false,port=9223 } = {}) {
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local CDP port');
  const endpoint = `http://127.0.0.1:${port}`;
  let target;
  if (!fresh) target = (await (await fetch(endpoint + '/json/list')).json()).find(t => t.type === 'page' && t.url.startsWith('http://localhost:5173'));
  if (!target) target = await (await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
    if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
  });
  async function send(method, params = {}) {
    const requestId = ++id;
    const answer = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(requestId, data => { clearTimeout(timer); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); });
    });
    ws.send(JSON.stringify({ id: requestId, method, params })); return answer;
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split('\n')[0] || result.exceptionDetails.text);
    return result.result.value;
  }
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  return {
    send, evaluate, errors, close: () => ws.close(),
    screenshot: async file => {
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, Buffer.from(result.data, 'base64'));
    },
  };
}
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function waitFor(page, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await page.evaluate(expression)) return true; await sleep(500); }
  return false;
}
