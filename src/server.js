import { loadConfig } from './config.js';
import { JsonStore } from './store.js';
import { UonClient, VkClient, Notifier } from './clients.js';
import { buildServer } from './app.js';

const config = loadConfig();
const store = new JsonStore(config.dataFile);
await store.init();
const server = buildServer({
  config,
  store,
  vk: new VkClient(config.vk),
  uon: new UonClient(config.uon),
  notifier: new Notifier(config.email, config.telegram),
});
server.listen(config.port, '0.0.0.0', () => console.log(`Listening on :${config.port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
