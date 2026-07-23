import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shows the official Yandex Business rating badge", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /yandex\.ru\/sprav\/widget\/rating-badge\/79890320490\?type=rating/);
  assert.match(html, /title="Рейтинг Сбежим на море в Яндекс Бизнесе"/);
  assert.doesNotMatch(html, /Контейнер для iframe Яндекс Бизнеса/);
});
