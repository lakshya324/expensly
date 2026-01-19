import { API_BASE, SP_CONFIG } from "../config/env.config";

export class HealthChecker {
  constructor() {
    this.url = API_BASE + '/health';
    this.interval = SP_CONFIG.initialInterval;
    this.maxInterval = SP_CONFIG.maxInterval;
    this.currentInterval = this.interval;
    this.pollTimer = null;
    this.failureCount = 0;
    this.onStatusChangeCallback = null;
    this.isHealthy = false;
  }

  start() {
    console.log('Health checker started');
    this.poll();
  }

  async poll() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SP_CONFIG.requestTimeout);

    try {
      const response = await fetch(this.url, {
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('Server healthy:', data.timestamp);
        
        this.isHealthy = true;
        this.failureCount = 0;
        this.currentInterval = this.interval; //reset
        this.updateStatus('healthy');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      this.isHealthy = false;
      this.failureCount++;
      
      console.error(`Health check failed (${this.failureCount}):`, error.message);
      this.updateStatus('unhealthy');
      
      // Exponential backoff
      this.currentInterval = Math.min(
        this.interval * Math.pow(SP_CONFIG.backoffFactor, this.failureCount - 1),
        this.maxInterval
      );
      
      console.log(`Next check in ${this.currentInterval}ms`);
    }

    this.pollTimer = setTimeout(() => this.poll(), this.currentInterval);
  }

  updateStatus(status) {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback('sp', status);
    }
  }

  // Todo: set callback in code later
  onStatusChange(callback) {
    this.onStatusChangeCallback = callback;
  }

  stop() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
      console.log('Health checker stopped');
    }
  }

  getStatus() {
    return {
      isHealthy: this.isHealthy,
      failureCount: this.failureCount,
      currentInterval: this.currentInterval
    };
  }
}