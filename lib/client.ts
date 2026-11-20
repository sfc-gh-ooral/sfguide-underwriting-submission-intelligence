// Browser-side access to UwData. Sample mode (and the hosted /try/ build, which has no server)
// uses the captured sample files directly; Live mode calls /api/data, which only talks to Snowflake.
import { HOSTED_EXAMPLE } from './hosted';
import { mockData } from './mock-data';
import { preferSample } from './mode';
import type { UwData } from './types';

type Op = keyof UwData;

async function call<T>(op: Op, args: unknown[]): Promise<T> {
  const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

const remote = new Proxy({} as UwData, {
  get: (_t, op: Op) => (...args: unknown[]) => call(op, args),
});

export async function fetchMode(): Promise<boolean> {
  let res: Response;
  try { res = await fetch('/api/mode'); } catch (e) { throw new Error(`Could not reach /api/mode: ${(e as Error).message}`); }
  if (!res.ok) throw new Error(`/api/mode failed (${res.status}); Live/Sample mode could not be determined.`);
  const j = await res.json().catch(() => null);
  if (!j || (j.mode !== 'live' && j.mode !== 'sample')) throw new Error('/api/mode returned an unexpected response.');
  return j.mode === 'live';
}

// Decided once per page load: the mode switch reloads the page.
let live: boolean | undefined;
async function useLive(): Promise<boolean> {
  if (HOSTED_EXAMPLE || preferSample()) return false;
  // If the mode check fails, surface the error instead of silently showing Sample data.
  if (live === undefined) live = await fetchMode();
  return live;
}

export const data = new Proxy({} as UwData, {
  get: (_t, op: Op) => async (...args: unknown[]) => {
    const impl = (await useLive()) ? remote : mockData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (impl[op] as (...a: any[]) => Promise<unknown>)(...args);
  },
});
