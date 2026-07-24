import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEGAL_DOCUMENTS } from '../src/legal-documents.js';

test('contract template follows current travel-agent form and stays editable',async()=>{
  const html=await readFile(new URL('../web/legal/tour-contract.html',import.meta.url),'utf8');
  assert.equal(LEGAL_DOCUMENTS['tour-contract'],'Шаблон договора о реализации туристского продукта');
  assert.match(html,/Приказу Минэкономразвития России от 18\.11\.2025 № 766/);
  assert.match(html,/Приложение № 1\. Заявка на бронирование/);
  assert.match(html,/Приложение № 2\. Информация о Турагенте и Туроператоре/);
  assert.match(html,/Работает онлайн по всей России|работает онлайн по всей России/);
  assert.match(html,/кв\. 61/);
});
