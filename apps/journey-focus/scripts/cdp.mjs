import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function connectPage({ fresh = false,port=9223,acceptBeforeUnload=false } = {}) {
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local CDP port');
  const endpoint = `http://127.0.0.1:${port}`;
  let target;
  if (!fresh) target = (await (await fetch(endpoint + '/json/list')).json()).find(t => t.type === 'page' && t.url.startsWith('http://localhost:5173'));
  if (!target) target = await (await fetch(endpoint + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map(), errors = [], errorDetails=[],dialogs=[],listeners=new Map();
  let beforeUnloadAction=acceptBeforeUnload?'accept':null;
  ws.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if(data.method==='Page.javascriptDialogOpening'){dialogs.push({type:data.params.type,message:data.params.message});if(data.params.type==='beforeunload'&&beforeUnloadAction)void send('Page.handleJavaScriptDialog',{accept:beforeUnloadAction==='accept'}).catch(()=>{});}
    if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); }
    if (data.method === 'Runtime.exceptionThrown') {errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);errorDetails.push(data.params.exceptionDetails);}
    if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {errors.push(data.params.entry.text);errorDetails.push(data.params.entry);}
    if(data.method)for(const listener of listeners.get(data.method)||[])listener(data.params,data.sessionId);
  });
  async function send(method, params = {},sessionId) {
    const requestId = ++id;
    const answer = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      pending.set(requestId, data => { clearTimeout(timer); if (data.error) reject(new Error(data.error.message)); else resolve(data.result); });
    });
    ws.send(JSON.stringify({ id: requestId, method, params,...(sessionId?{sessionId}:{}) })); return answer;
  }
  async function evaluate(expression,sessionId) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true },sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split('\n')[0] || result.exceptionDetails.text);
    return result.result.value;
  }
  await send('Runtime.enable'); await send('Log.clear'); await send('Log.enable'); await send('Page.enable');
  return {
    send, evaluate, errors, errorDetails,dialogs,on(method,listener){if(!listeners.has(method))listeners.set(method,new Set());listeners.get(method).add(listener);return()=>listeners.get(method)?.delete(listener);},setBeforeUnloadAction(action){if(![null,'accept','dismiss'].includes(action))throw new Error('Invalid dialog action');beforeUnloadAction=action;},close: () => ws.close(),
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
