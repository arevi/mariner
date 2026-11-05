import { syncVessels } from './db';
import { listen } from './stream';
import { VesselState } from './state';
import { flush, loadPrevious } from './store';

async function run(env: Env) {
  const windowSec = Number(env.LISTEN_SECONDS) || 480;
  const startedAt = Date.now();
  const deadline = startedAt + windowSec * 1000;
  console.log(`ingest start: listening for ${windowSec}s`);

  const previous = await loadPrevious(env.VESSELS);
  const state = new VesselState();
  state.load(previous.records);
  console.log(`loaded ${previous.records.length} vessels from previous run (${Date.now() - startedAt}ms)`);

  await listen(env.AISSTREAM_API_KEY, state, deadline);

  const records = state.finalize();
  console.log(`listen done: ${state.messageCount} messages, ${records.length} vessels after expiry; writing to R2`);
  const manifest = await flush(
    env.VESSELS,
    records,
    { runId: crypto.randomUUID(), messageCount: state.messageCount, windowSec },
    previous.manifest,
  );
  // R2 is the source for the map, so a D1 failure must not fail the run.
  try {
    console.log('d1 sync', await syncVessels(env.DB, state));
  } catch (error) {
    console.error('d1 sync failed', error);
  }
  console.log('ingest complete', {
    vessels: manifest.vesselCount,
    messages: manifest.messageCount,
    tiles: manifest.tiles.length,
    durationSec: Math.round((Date.now() - startedAt) / 1000),
  });
  return manifest;
}

export default {
  async scheduled(_controller, env) {
    await run(env);
  },
} satisfies ExportedHandler<Env>;
