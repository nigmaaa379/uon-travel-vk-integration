import { existsSync } from 'node:fs';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

const apiKey = process.env.UON_API_KEY?.trim();
if (!apiKey) {
  console.error('UON_API_KEY is required (set it in the environment or .env)');
  process.exit(1);
}

const leadId = process.argv[2]?.trim();
if (!leadId || !/^\d+$/.test(leadId)) {
  console.error('Usage: node test/get-uon-lead.mjs <lead-id>');
  process.exit(1);
}

const url = 'https://api.u-on.ru/' + encodeURIComponent(apiKey) + '/lead/' + leadId + '.json';
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
const text = await response.text();
let data;
try { data = text ? JSON.parse(text) : {}; } catch { data = text; }

if (!response.ok) {
  console.error(`U-ON HTTP ${response.status}:`, data);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
