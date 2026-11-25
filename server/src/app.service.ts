import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthResult {
  status: 'ok' | 'error';
  db: 'up' | 'down';
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly dataSource: DataSource) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  async getHealth(): Promise<HealthResult> {
    const dbUp = await this.checkDatabase();
    return { status: dbUp ? 'ok' : 'error', db: dbUp ? 'up' : 'down' };
  }
}
