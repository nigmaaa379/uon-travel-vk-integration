import { existsSync } from 'node:fs';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

const apiKey = process.env.UON_API_KEY?.trim();
if (!apiKey) {
  console.error('UON_API_KEY is required (set it in the environment or .env)');
  process.exit(1);
}

const url = 'https://api.u-on.ru/' + encodeURIComponent(apiKey) + '/manager.json';
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
const text = await response.text();
let data;
try { data = text ? JSON.parse(text) : {}; } catch { data = text; }

if (!response.ok) {
  console.error(`U-ON HTTP ${response.status}:`, data);
  process.exit(1);
}

const managers = Array.isArray(data) ? data : data.managers ?? data.manager ?? data.users ?? data;
console.log(JSON.stringify(managers, null, 2));
