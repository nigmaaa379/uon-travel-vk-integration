import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("cookie choice can be accepted rejected and changed",async()=>{const h=await readFile(new URL("../web/index.html",import.meta.url),"utf8");const j=await readFile(new URL("../web/assets/cookie-consent.js",import.meta.url),"utf8");assert.match(h,/cookie-consent\.js/);assert.match(j,/reject-cookies/);assert.match(j,/seaEscapeCookieRejected/);assert.match(j,/cookie-settings/);assert.match(j,/METRIKA_ID,'destruct'/)});
