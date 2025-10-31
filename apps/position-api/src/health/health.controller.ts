import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /health - Liveness probe
   * Returns 200 OK if the service is alive
   */
  @Get()
  liveness(): { ok: boolean } {
    return { ok: true };
  }

  /**
   * GET /health/ready - Readiness probe
   * Checks Kafka, Redis, and PostgreSQL connectivity
   * Returns 200 OK if all dependencies are healthy, 503 Service Unavailable otherwise
   */
  @Get('ready')
  async readiness(): Promise<{ ok: boolean; checks: Record<string, boolean> }> {
    const checks = await this.healthService.checkReadiness();
    const allHealthy = Object.values(checks).every(v => v === true);

    if (!allHealthy) {
      throw new HttpException(
        { ok: false, checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true, checks };
  }
}
