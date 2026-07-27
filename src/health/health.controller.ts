import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Readiness check: 200 only when we can actually serve traffic, 503 otherwise,
   * so a k8s readinessProbe can pull a pod out of the Service when its database
   * is unreachable. Don't point a livenessProbe at this — a DB blip would then
   * restart pods instead of just parking them.
   */
  @Public()
  @Get()
  async check() {
    let database = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    const body = {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };

    if (database !== 'up') {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
