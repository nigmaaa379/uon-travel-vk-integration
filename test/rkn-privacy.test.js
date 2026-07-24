import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("publishes canonical privacy policy and consent-gates Yandex",async()=>{
 const html=await readFile(new URL("../web/index.html",import.meta.url),"utf8");
 const policy=await readFile(new URL("../web/legal/privacy.html",import.meta.url),"utf8");
 const server=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(html,/href="\/page\/privacy"/);
 assert.match(html,/data-consent-src="https:\/\/yandex\.ru\/sprav\/widget/);
 assert.doesNotMatch(html,/href="\/legal\/privacy\.html"/);
 assert.match(policy,/ИП Горева Любовь Григорьевна/);
 assert.match(policy,/U-ON Travel/);
 assert.match(policy,/счётчик № 110979041/);
 assert.match(server,/pathname==='\/page\/privacy'/);
});
