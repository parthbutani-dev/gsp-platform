#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command) {
  console.log(`\n> ${command}\n`);
  execSync(command, { stdio: 'inherit', cwd: root });
}

if (!existsSync(resolve(root, '.env'))) {
  copyFileSync(resolve(root, '.env.example'), resolve(root, '.env'));
  console.log('Created .env from .env.example');
}

run('docker compose up -d --wait');
run('npm install');
run('npm run build:shared');
run('npm run seed');

console.log('\nSetup complete.');
console.log('  Terminal 1: npm run dev:backend');
console.log('  Terminal 2: npm run dev:frontend');
console.log('  Open http://localhost:4200\n');
