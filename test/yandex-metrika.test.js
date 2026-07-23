import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("loads Yandex Metrika only after analytics consent", async () => {
  const script = await readFile(new URL("../web/assets/app.js", import.meta.url), "utf8");
  assert.match(script, /YANDEX_METRIKA_ID\s*=\s*110979041/);
  assert.match(script, /seaEscapeCookieConsent/);
  assert.match(script, /analytics-consent-granted/);
  assert.match(script, /mc\.yandex\.ru\/metrika\/tag\.js/);
});

test("allows Yandex Metrika in CSP", async () => {
  const server = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(server, /script-src[^;]*https:\/\/mc\.yandex\.ru/);
  assert.match(server, /connect-src[^;]*https:\/\/mc\.yandex\.ru/);
  assert.match(server, /img-src[^;]*https:\/\/mc\.yandex\.ru/);
});
