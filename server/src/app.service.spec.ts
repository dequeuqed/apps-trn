import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AppService } from './app.service.js';

describe('AppService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports ok when the database responds', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValue([{}]),
    } as unknown as DataSource;
    const service = new AppService(dataSource);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('reports error when the database query fails', async () => {
    const dataSource = {
      query: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as DataSource;
    const service = new AppService(dataSource);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'error',
      db: 'down',
    });
  });
});
