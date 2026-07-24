import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.js';
import { renderLegalDocument, sanitizeLegalHtml, validateLegalDocument } from '../src/legal-documents.js';

test('sanitizes legal editor HTML and rejects scripts',()=>{
  assert.equal(sanitizeLegalHtml('<h2>Раздел</h2><p><b>Текст</b></p>'),'<h2>Раздел</h2><p><b>Текст</b></p>');
  assert.throws(()=>sanitizeLegalHtml('<script>alert(1)</script>'),/небезопасный HTML/);
  assert.throws(()=>validateLegalDocument({slug:'privacy',title:'Политика',version:'2026-07-24',contentHtml:'<p onclick="x()">Текст</p>'}),/небезопасный HTML/);
});

test('stores current legal document and revision history',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'legal-docs-'));try{const store=new JsonStore(join(dir,'store.json'));await store.init();await store.saveLegalDocument({slug:'privacy',title:'Политика 1',version:'2026-07-24',contentHtml:'<p>Первая</p>'});await store.saveLegalDocument({slug:'privacy',title:'Политика 2',version:'2026-08-01',contentHtml:'<p>Вторая</p>'});const saved=store.getLegalDocument('privacy');assert.equal(saved.version,'2026-08-01');assert.equal(saved.history.length,1);assert.equal(saved.history[0].contentHtml,'<p>Первая</p>')}finally{await rm(dir,{recursive:true,force:true})}
});

test('renders a safe public legal page',()=>{const html=renderLegalDocument({slug:'privacy',label:'Политика конфиденциальности',title:'Политика конфиденциальности',version:'2026-08-01',contentHtml:'<h2>Общие положения</h2><p>Текст</p>'});assert.match(html,/Редакция от 1 августа 2026 года/);assert.match(html,/https:\/\/tursbezhimnamore\.ru\/page\/privacy/);assert.doesNotMatch(html,/\{\{https:/)});
