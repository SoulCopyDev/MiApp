// Driver CDP mínimo para auditar la app en web (Node 24, WebSocket nativo).
// Uso: node .claude/cdp.mjs "<expresión JS>"
// La expresión se evalúa en la página y se imprime el resultado.

const targets = await (await fetch('http://localhost:9222/json')).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:8081'));
if (!page) { console.error('No hay pestaña en localhost:8081. Targets:', targets.map(t => t.url)); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params }));
});

await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg); pending.delete(msg.id); }
});

const expr = process.argv[2];
const res = await send('Runtime.evaluate', {
  expression: expr,
  returnByValue: true,
  awaitPromise: true,
  userGesture: true, // necesario para que RNW trate el click como interacción real
});

if (res.result?.exceptionDetails) {
  console.error('EXCEPCIÓN:', JSON.stringify(res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails));
  process.exit(1);
}
console.log(JSON.stringify(res.result?.result?.value ?? null, null, 2));
ws.close();
