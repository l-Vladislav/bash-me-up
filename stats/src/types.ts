/**
 * What the admin API answers. Shared with the admin page (`src/admin/`), so
 * both sides agree on the shape at compile time.
 */

export interface Top {
  label: string;
  visitors: number;
  hits: number;
}

export interface DayCount {
  /** YYYY-MM-DD, UTC */
  day: string;
  views: number;
  visitors: number;
}

export const TOP_KEYS = [
  'countries',
  'cities',
  'referrers',
  'networks',
  'pages',
  'commands',
  'devices',
  'browsers',
  'languages',
] as const;

export type TopKey = (typeof TOP_KEYS)[number];

export interface Overview {
  days: number;
  /** Visitors seen in the last few minutes, by a view or a command. */
  online: number;
  today: { views: number; visitors: number };
  totals: {
    views: number;
    visitors: number;
    /** Visitors whose very first view falls inside the period. */
    newVisitors: number;
    countries: number;
    commands: number;
  };
  /** Oldest first; days without views are left out. */
  daily: DayCount[];
  tops: Record<TopKey, Top[]>;
}

export interface VisitEvent {
  id: number;
  at: number;
  type: 'view' | 'command';
  name: string;
  visitor: string;
  country: string | null;
  region: string | null;
  city: string | null;
  network: string | null;
  referrer: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  lang: string | null;
  screen: string | null;
}

export interface Feed {
  events: VisitEvent[];
  /** Pass as `before` for the next page; null at the end. */
  next: number | null;
}

export interface VisitorStory {
  visitor: string;
  first: number;
  last: number;
  /** Days with at least one event. */
  days: number;
  views: number;
  commands: number;
  /** Newest first, at most a few hundred. */
  events: VisitEvent[];
}

export interface Health {
  events: number;
  oldest: number | null;
  newest: number | null;
  /** Size of the database file. */
  bytes: number;
  retentionDays: number;
}

export interface Session {
  token: string;
  expires: number;
}
