import { NextResponse } from 'next/server';
import { isSnowflakeConfigured } from '@/lib/snowflake';
import type { UwData } from '@/lib/types';

// Live mode only: Sample mode runs in the browser on captured files (lib/mock-data.ts).
// Live failures are returned as errors, never replaced with sample data.
const OPS = new Set<keyof UwData>(['queue', 'detail', 'portfolio', 'memo', 'brokerEmail', 'decide', 'ask', 'recheck']);
const DECISIONS = new Set(['REQUEST_INFO', 'DECLINE', 'QUOTE']);

export async function POST(request: Request) {
  const { op, args } = await request.json();
  if (!OPS.has(op) || !Array.isArray(args)) return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  if (['detail', 'portfolio', 'memo', 'brokerEmail', 'decide', 'recheck'].includes(op) && !/^SUB-\d{4}$/.test(String(args[0]))) return NextResponse.json({ error: 'Unknown submission' }, { status: 400 });
  if (op === 'decide' && (!DECISIONS.has(String(args[1])) || String(args[2] ?? '').length > 2000)) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  if (op === 'ask' && (typeof args[0] !== 'string' || args[0].length > 500)) return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
  if (!isSnowflakeConfigured()) return NextResponse.json({ error: 'No Snowflake connection is configured. Switch to Sample mode or set up .env.local.' }, { status: 503 });

  const { liveData } = await import('@/lib/live-data');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (liveData[op as keyof UwData] as (...a: any[]) => Promise<unknown>)(...args);
    return NextResponse.json(result ?? { notFound: true });
  } catch (error) {
    console.error(`${op} failed:`, error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
