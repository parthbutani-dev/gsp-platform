import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGODB_URI ?? '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-secret',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '8h',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  allowHeaderAuth: process.env.ALLOW_HEADER_AUTH === 'true',
  enableSeed: process.env.ENABLE_SEED === 'true',
  aiProvider: process.env.AI_PROVIDER ?? 'mock',
  aiRequestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '30000', 10),
};
