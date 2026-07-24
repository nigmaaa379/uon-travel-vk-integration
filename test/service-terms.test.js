import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEGAL_DOCUMENTS } from '../src/legal-documents.js';

test('uses service terms instead of a public offer',async()=>{const terms=await readFile(new URL('../web/legal/service-terms.html',import.meta.url),'utf8');const legacy=await readFile(new URL('../web/legal/offer.html',import.meta.url),'utf8');const sitemap=await readFile(new URL('../web/sitemap.xml',import.meta.url),'utf8');assert.equal(LEGAL_DOCUMENTS.offer,undefined);assert.equal(LEGAL_DOCUMENTS['service-terms'],'Условия оказания турагентских услуг');assert.match(terms,/не является публичной офертой/);assert.match(legacy,/url=\/legal\/service-terms\.html/);assert.match(sitemap,/\/legal\/service-terms\.html/);assert.doesNotMatch(sitemap,/\/legal\/offer\.html/)});
