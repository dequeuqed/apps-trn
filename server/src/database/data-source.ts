import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}

const distRoot = join(import.meta.dirname, '..');

export default new DataSource({
  type: 'postgres',
  url,
  uuidExtension: 'pgcrypto',
  installExtensions: false,
  synchronize: false,
  entities: [join(distRoot, '**', '*.entity.js')],
  migrations: [join(distRoot, 'database', 'migrations', '*.js')],
  migrationsTableName: 'migrations',
});
