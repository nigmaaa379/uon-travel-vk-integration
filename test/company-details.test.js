import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

test("publishes verified company details without placeholders", async () => {
  const index = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  for (const value of ["ИП Горева Любовь Григорьевна", "761700450685", "325762700017919", "РТА 0049975", "+7 (920) 124-20-33", "l_g_goreva@mail.ru"]) assert.match(index, new RegExp(value.replace(/[()+]/g, "\\$&")));
  for (const placeholder of ["example.ru", "+7 (000) 000-00-00", "hello@example.ru", "[ИНН]", "[ОГРН]", "[RTA]", "t.me/username"]) assert.equal(index.includes(placeholder), false);
  const dir = new URL("../web/legal/", import.meta.url);
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".html")) continue;
    const html = await readFile(new URL(file, dir), "utf8");
    assert.match(html, /ИП Горева Любовь Григорьевна/);
    assert.match(html, /761700450685/);
    assert.match(html, /l_g_goreva@mail.ru/);
  }
});
