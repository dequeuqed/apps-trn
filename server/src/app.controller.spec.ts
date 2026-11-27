import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let controller: AppController;
  const appService = { getHealth: vi.fn() };

  beforeEach(async () => {
    appService.getHealth.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();
    controller = moduleRef.get(AppController);
  });

  it('returns health when the database is up', async () => {
    appService.getHealth.mockResolvedValue({ status: 'ok', db: 'up' });

    await expect(controller.health()).resolves.toStrictEqual({
      status: 'ok',
      db: 'up',
    });
  });

  it('throws 503 when the database is down', async () => {
    appService.getHealth.mockResolvedValue({ status: 'error', db: 'down' });

    const result = controller.health();

    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(result).rejects.toMatchObject({
      response: { status: 'error' },
    });
  });
});
