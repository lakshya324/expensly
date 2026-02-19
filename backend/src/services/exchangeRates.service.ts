// Exchange Rates Service
// Deterministic simulation: fixed base rates with small bounded random variation.
// Uses a single shared EventEmitter + one setInterval for the whole server
// — no per-client timers.

import { EventEmitter } from 'events';
import { SSE_UPDATE_INTERVAL } from '../config/constants.js';

type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR' | 'CAD';
type RateMap = Record<CurrencyCode, number>;

// Fixed base rates (USD = 1)
const BASE_RATES: RateMap = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  INR: 83.1,
  CAD: 1.36,
};

// Maximum percentage fluctuation per tick
const MAX_DRIFT: RateMap = {
  USD: 0,
  EUR: 0.003,
  GBP: 0.003,
  JPY: 0.5,
  INR: 0.4,
  CAD: 0.003,
};

// Accumulated drift from base (keeps rates realistic)
const drift: RateMap = { USD: 0, EUR: 0, GBP: 0, JPY: 0, INR: 0, CAD: 0 };

const emitter = new EventEmitter();
let currentRates: RateMap = { ...BASE_RATES };

const tick = (): void => {
  const rates = {} as RateMap;
  for (const [currency, base] of Object.entries(BASE_RATES) as [CurrencyCode, number][]) {
    const maxD = MAX_DRIFT[currency];
    drift[currency] = Math.max(
      -maxD * 5,
      Math.min(maxD * 5, drift[currency] + (Math.random() * 2 - 1) * maxD)
    );
    rates[currency] =
      currency === 'USD' ? 1 : parseFloat((base + drift[currency]).toFixed(4));
  }
  currentRates = rates;
  emitter.emit('rates', rates);
};

// Start the single global interval
setInterval(tick, SSE_UPDATE_INTERVAL);
tick(); // emit immediately on boot

export const ExchangeRatesService = {
  /**
   * Subscribe a callback to rate updates.
   * @param cb - Called with the rates object on every tick
   * @returns Unsubscribe function
   */
  subscribe(cb: (rates: RateMap) => void): () => void {
    emitter.on('rates', cb);
    // Send current rates immediately to new subscriber
    cb(currentRates);
    return () => emitter.off('rates', cb);
  },

  getCurrentRates(): RateMap {
    return currentRates;
  },
};
