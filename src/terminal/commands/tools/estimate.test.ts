import { describe, expect, it } from 'vitest';
import { toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute } from '../index';
import type { CommandContext } from '../types';
import {
  downtime,
  formatBytes,
  formatCount,
  formatDuration,
  parseBytes,
  parseCount,
  serversNeeded,
  storageTotals,
  traffic,
} from './estimate';

const context: CommandContext = {
  settings: DEFAULT_SETTINGS,
  history: [],
  random: () => 0,
  now: 0,
  bootedAt: 0,
};

const output = (input: string): string => execute(input, context).lines.map(toPlainText).join('\n');

describe('reading and writing numbers', () => {
  it('reads counts with K, M, B and T', () => {
    expect(parseCount('250')).toBe(250);
    expect(parseCount('1.5k')).toBe(1500);
    expect(parseCount('100M')).toBe(1e8);
    expect(parseCount('2B')).toBe(2e9);
    expect(parseCount('0')).toBeUndefined();
    expect(parseCount('lots')).toBeUndefined();
  });

  it('reads sizes in decimal units', () => {
    expect(parseBytes('200')).toBe(200);
    expect(parseBytes('2KB')).toBe(2000);
    expect(parseBytes('1.5gb')).toBe(1.5e9);
    expect(parseBytes('2KiB')).toBeUndefined();
  });

  it('prints three significant digits with a unit', () => {
    expect(formatCount(11_574.07)).toBe('11.6K');
    expect(formatCount(1e9)).toBe('1B');
    expect(formatCount(12)).toBe('12');
    expect(formatBytes(7.3e12)).toBe('7.3 TB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatDuration(31_536)).toBe('8.76 h');
    expect(formatDuration(0.0864)).toBe('86.4 ms');
  });
});

describe('qps', () => {
  it('spreads daily requests over 86,400 seconds', () => {
    const { perDay, average, peak } = traffic(100e6, 10, 2);
    expect(perDay).toBe(1e9);
    expect(average).toBeCloseTo(11_574.07, 2);
    expect(peak).toBeCloseTo(23_148.15, 2);
  });

  it('prints average and peak', () => {
    const report = output('qps 100M 10');
    expect(report).toContain('1B');
    expect(report).toContain('11.6K QPS');
    expect(report).toContain('peak (x2)');
    expect(report).toContain('23.1K QPS');
    expect(output('qps 100M')).toContain('usage: qps');
  });
});

describe('storage', () => {
  it('adds up days, years and replicas', () => {
    const totals = storageTotals(10e6, 2000, 5, 3);
    expect(formatBytes(totals.day)).toBe('20 GB');
    expect(formatBytes(totals.year)).toBe('7.3 TB');
    expect(formatBytes(totals.total)).toBe('36.5 TB');
    expect(formatBytes(totals.replicated)).toBe('110 TB');
  });

  it('leaves out the replica row for a single copy', () => {
    expect(output('storage 10M 2KB')).toContain('x3 copies');
    expect(output('storage 10M 2KB 5 1')).not.toContain('copies');
  });
});

describe('bandwidth and servers', () => {
  it('turns a request rate into throughput', () => {
    const report = output('bandwidth 12K 500KB');
    expect(report).toContain('6 GB/s');
    expect(report).toContain('48 Gbps');
    expect(report).toContain('518 TB');
  });

  it('rounds the fleet up and keeps headroom', () => {
    expect(serversNeeded(23_000, 2000, 0.3)).toBe(17);
    expect(serversNeeded(23_000, 2000, 0)).toBe(12);
    expect(output('servers 23K 2K 50')).toContain('23 servers');
    expect(output('servers 23K 2K 100')).toContain('usage: servers');
  });
});

describe('nines', () => {
  it('converts availability into downtime', () => {
    expect(downtime(99.9, 365 * 86_400)).toBeCloseTo(31_536);
    const report = output('nines 99.99');
    expect(report).toContain('52.6 min');
    expect(report).toContain('8.64 s');
  });

  it('lists the common levels by default', () => {
    const report = output('nines');
    for (const level of ['99%', '99.9%', '99.95%', '99.99%', '99.999%']) {
      expect(report).toContain(level);
    }
    expect(output('nines 120')).toContain('usage: nines');
  });
});

describe('reference tables', () => {
  it('latency runs from nanoseconds to a transatlantic round trip', () => {
    const report = output('latency');
    expect(report).toContain('0.5 ns   L1 cache reference');
    expect(report).toContain('150 ms   Round trip CA-Netherlands-CA');
  });

  it('pow2 gives exact and rounded values', () => {
    const report = output('pow2');
    expect(report).toContain('1,048,576');
    expect(report).toContain('1 quadrillion');
    expect(report).toContain('86,400');
  });

  it('the tools page lists them as a group of their own', () => {
    const page = output('help tools');
    expect(page).toContain('SYSTEM DESIGN');
    expect(page).toContain('UTILITIES');
    expect(page.indexOf('qps')).toBeLessThan(page.indexOf('calc'));
  });
});
