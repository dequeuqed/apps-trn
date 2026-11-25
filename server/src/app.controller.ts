import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService, HealthResult } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async health(): Promise<HealthResult> {
    const result = await this.appService.getHealth();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException({ status: 'error' });
    }
    return result;
  }
}
