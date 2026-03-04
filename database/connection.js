import { Sequelize } from 'sequelize';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const normalizeSqlitePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === ':memory:') return raw;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(projectRoot, raw);
};

const resolveSqliteStorage = () => {
  if (process.env.NODE_ENV === 'test') return ':memory:';

  const explicitStorage = normalizeSqlitePath(process.env.SQLITE_STORAGE);
  if (explicitStorage) return explicitStorage;

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (databaseUrl.toLowerCase().startsWith('sqlite:')) {
    const fromUrl = databaseUrl.replace(/^sqlite:(\/\/)?/i, '');
    const normalized = normalizeSqlitePath(fromUrl);
    if (normalized) return normalized;
  }

  return path.join(__dirname, 'kyrbi.sqlite');
};

const sqliteStorage = resolveSqliteStorage();
if (sqliteStorage !== ':memory:') {
  mkdirSync(path.dirname(sqliteStorage), { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqliteStorage,
  logging: false,
});

export default sequelize;
