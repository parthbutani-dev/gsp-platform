import { Router } from 'express';
import { env } from '../config/env';
import { forbidden } from '../utils/errors';
import { runSeed } from '../scripts/seed';

const router = Router();

router.post('/', async (_req, res, next) => {
  try {
    if (!env.enableSeed) throw forbidden('Seed disabled');
    const result = await runSeed();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
