import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercent } from './formatters';

describe('formatters', () => {
  it('formats compact currency values', () => {
    expect(formatCurrency(1250, 'USD', true)).toContain('$');
  });

  it('formats missing percentages as unavailable', () => {
    expect(formatPercent(null)).toBe('-');
  });
});
