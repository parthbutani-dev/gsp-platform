import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { csrfProtection } from './middleware/csrf';
import authRoutes from './routes/auth.routes';
import applicationsRoutes from './routes/applications.routes';
import seedRoutes from './routes/seed.routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: env.nodeEnv === 'production' }));
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/auth/seed', seedRoutes);
app.use('/api/applications', applicationsRoutes);

app.use(errorHandler);

async function start() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required');
  }
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');

  app.listen(env.port, () => {
    console.log(`GSP API listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

export default app;
