// Sample-mode response time per AI surface, in ms, close to the live timings in the README.
// Jitter is applied in lib/mock-data.ts and the result is clamped to 4-8 s.
export const SAMPLE_DELAY_MS = { memo: 6800, email: 5200, ask: 6600 } as const;
export const SAMPLE_DELAY_BOUNDS_MS = { min: 4000, max: 8000 } as const;
