// Exchange Rates Service
// Generates dummy exchange rates for SSE

export class ExchangeRatesService {
  static generateRates() {
    return {
      USD: 1,
      EUR: (0.85 + Math.random() * 0.05).toFixed(4),
      GBP: (0.73 + Math.random() * 0.05).toFixed(4),
      JPY: (110 + Math.random() * 10).toFixed(2),
      INR: (74 + Math.random() * 5).toFixed(2),
      CAD: (1.25 + Math.random() * 0.05).toFixed(4),
    };
  }
}
