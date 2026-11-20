// Shapes shared by the sample and live data sources.
export type Source = 'mock' | 'snowflake';
export interface Provenance { source: Source; latencyMs?: number; role?: string }
export type Appetite = 'IN' | 'REFER' | 'OUT';

export interface QueueRow {
  id: string; insured: string; city: string; state: string; receivedAt: string; daysWaiting: number; fifo: number;
  declaredClass: string; predictedClass: string; className: string; tiv: number; broker: string; brokerTier: string;
  appetite: Appetite; reasons: string[]; missing: string[]; fit: number;
  pts: { appetite: number; completeness: number; broker: number; loss: number; concentration: number };
}
export interface Queue extends Provenance {
  rows: QueueRow[];
  kpis: { open: number; avgDays: number; inAppetitePct: number; incomplete: number; out: number; tiv: number };
  byDay: { date: string; count: number }[];
}

export interface Box { page: number; upperLeft: [number, number]; lowerRight: [number, number] }
export interface ExtractedField { key: string; label: string; value: string; boxes: Box[] }
export interface LossYear { year: number; carrier: string; claims: number; incurred: number; paid: number; open: number; largest: string }
export interface Location {
  loc: number; street: string; city: string; state: string; lat: number; lon: number; construction: string; yearBuilt: number;
  sprinklered: string; tiv: number; kmToCoast: number; coastal: boolean; nearbyPolicies: number; nearbyTiv: number;
}
export interface GuideHit { ruleId: string; section: string; appetite: string; text: string }
export interface Decision { decision: string; reason: string; at: string; by: string }

export interface Detail extends Provenance {
  row: QueueRow;
  fields: ExtractedField[];
  operations: string; parsedChars: number;
  losses: LossYear[] | null;
  locations: Location[];
  email: { from: string; subject: string; body: string; sentAt: string };
  guide: GuideHit[];
  decisions: Decision[];
}

export interface Portfolio extends Provenance {
  cells: { lat: number; lon: number; tiv: number; locations: number }[];
  coast: [number, number][];
  locations: Location[];
  totals: { portfolioTiv: number; coastalTiv: number; nearbyTiv: number; submissionTiv: number; submissionCoastalTiv: number; zoneShareBefore: number; zoneShareAfter: number };
}

export interface AiText extends Provenance { text: string; model?: string; sources: string[] }
export interface AskAnswer extends Provenance { text: string; sql?: string; columns?: string[]; rows?: (string | number | null)[][]; sources: string[] }

// "Re-check" on the submission file: the document AI and the proximity check run again, live.
export interface RecheckField { key: string; label: string; value: string; stored: string }
export interface RecheckLocation { loc: number; city: string; state: string; nearbyPolicies: number; nearbyTiv: number; storedNearbyTiv: number }
export interface Recheck extends Provenance {
  parsedChars: number; storedParsedChars: number;
  fields: RecheckField[];
  predictedClass: string; storedClass: string; declaredClass: string;
  appetite: string; className: string; maxTiv: number | null;
  locations: RecheckLocation[];
  timings?: { parse: number; extract: number; classify: number; proximity: number };
}

export interface UwData {
  queue(): Promise<Queue>;
  detail(id: string): Promise<Detail | null>;
  portfolio(id: string): Promise<Portfolio | null>;
  memo(id: string): Promise<AiText>;
  brokerEmail(id: string): Promise<AiText>;
  decide(id: string, decision: 'REQUEST_INFO' | 'DECLINE' | 'QUOTE', reason: string): Promise<{ ok: true } & Provenance>;
  ask(question: string): Promise<AskAnswer>;
  recheck(id: string): Promise<Recheck | null>;
}
