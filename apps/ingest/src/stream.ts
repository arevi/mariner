import type { VesselState } from './state';

const URL = 'https://stream.aisstream.io/v0/stream';
const MESSAGE_TYPES = [
  'PositionReport',
  'StandardClassBPositionReport',
  'ExtendedClassBPositionReport',
  'ShipStaticData',
  'StaticDataReport',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(apiKey: string): Promise<WebSocket> {
  const response = await fetch(URL, { headers: { Upgrade: 'websocket', 'Sec-WebSocket-Extensions': 'permessage-deflate' } });
  const ws = response.webSocket;
  if (!ws) throw new Error(`WebSocket upgrade failed (${response.status})`);
  ws.binaryType = 'arraybuffer';
  ws.accept();
  // Must arrive within 3s of connecting.
  ws.send(
    JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [
        [
          [-90, -180],
          [90, 180],
        ],
      ],
      FilterMessageTypes: MESSAGE_TYPES,
    }),
  );
  return ws;
}

/** Streams AIS messages into `state` until `deadline` (epoch ms), reconnecting with backoff. */
export async function listen(apiKey: string, state: VesselState, deadline: number) {
  let attempt = 0;
  while (Date.now() < deadline) {
    try {
      const ws = await connect(apiKey);
      attempt = 0;
      console.log('connected, subscription sent');
      const progress = setInterval(
        () =>
          console.log(
            `progress: ${state.messageCount} messages, ${state.vessels.size} vessels, ${Math.round((deadline - Date.now()) / 1000)}s left`,
          ),
        30_000,
      );
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        ws.addEventListener('message', (event) => {
          const data = event.data;
          state.ingest(typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer));
        });
        ws.addEventListener('close', (event) => {
          if (Date.now() < deadline) console.warn(`socket closed early: ${event.code} ${event.reason}`);
          done();
        });
        ws.addEventListener('error', () => {
          console.warn('socket error');
          done();
        });
      }).finally(() => {
        clearInterval(progress);
        ws.close(1000, 'window complete');
      });
    } catch (error) {
      console.error('stream error', error);
    }
    if (Date.now() >= deadline) break;
    const backoff = Math.min(30_000, 1000 * 2 ** attempt++);
    console.log(`reconnecting (attempt ${attempt})`);
    await sleep(Math.min(backoff * (0.5 + Math.random()), Math.max(0, deadline - Date.now())));
  }
}
