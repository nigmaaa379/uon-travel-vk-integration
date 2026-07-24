import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderLegalDocument } from '../src/legal-documents.js';

const channels=['https://vk.com/turagentgorevalubov','https://t.me/tur_sbezhimnamore','https://max.ru/channel_id761700450685_biz'];
test('publishes direct official channel links on website and legal pages',async()=>{const app=await readFile(new URL('../web/assets/app.js',import.meta.url),'utf8');const legal=renderLegalDocument({slug:'privacy',label:'Политика',title:'Политика конфиденциальности',version:'2026-07-24',contentHtml:'<p>Текст</p>'});for(const url of channels){assert.match(app,new RegExp(url.replace(/[./]/g,'\\$&')));assert.match(legal,new RegExp(url.replace(/[./]/g,'\\$&')))}});
