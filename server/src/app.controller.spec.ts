import { Test, TestingModule } from '@nestjs/testing';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  const dataSource = { query: vi.fn() };

  beforeEach(async () => {
    dataSource.query.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('health', () => {
    it('returns ok when the database responds', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.health()).resolves.toStrictEqual({
        status: 'ok',
        db: 'up',
      });
      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('throws 503 when the database query fails', async () => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      dataSource.query.mockRejectedValue(new Error('connection refused'));

      const result = appController.health();

      await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(result).rejects.toMatchObject({
        response: { status: 'error' },
      });
    });
  });
});
