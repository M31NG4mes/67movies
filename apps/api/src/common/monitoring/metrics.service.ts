import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private totalRequests = 0;
  private clientErrors4xx = 0;
  private serverErrors5xx = 0;
  private rateLimited429 = 0;
  private readonly recentLatencies: number[] = [];
  private readonly maxLatencySamples = 500;

  recordRequest(statusCode: number, durationMs: number) {
    this.totalRequests++;
    if (statusCode === 429) this.rateLimited429++;
    if (statusCode >= 400 && statusCode < 500) this.clientErrors4xx++;
    if (statusCode >= 500) this.serverErrors5xx++;

    this.recentLatencies.push(durationMs);
    if (this.recentLatencies.length > this.maxLatencySamples) {
      this.recentLatencies.shift();
    }
  }

  getSnapshot() {
    const sorted = [...this.recentLatencies].sort((a, b) => a - b);
    const avgLatencyMs =
      sorted.length > 0
        ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10
        : 0;
    const p95Index = Math.max(0, Math.floor(sorted.length * 0.95) - 1);
    const p95LatencyMs = sorted.length > 0 ? Math.round(sorted[p95Index] * 10) / 10 : 0;
    const mem = process.memoryUsage();

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      requests: {
        total: this.totalRequests,
        errors4xx: this.clientErrors4xx,
        errors5xx: this.serverErrors5xx,
        rateLimited429: this.rateLimited429,
        avgLatencyMs,
        p95LatencyMs,
      },
      memoryMb: {
        rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
      },
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}
