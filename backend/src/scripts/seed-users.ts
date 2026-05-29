import mongoose from 'mongoose';
import { env } from '../config/env';
import { upsertDemoUsers, DEMO_PASSWORD } from './seed';

async function main() {
  if (!env.mongoUri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri);
  const users = await upsertDemoUsers();
  console.log(
    JSON.stringify(
      {
        message: 'Demo users upserted',
        users: users.map((u) => ({ email: u.email, role: u.role, password: DEMO_PASSWORD })),
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
