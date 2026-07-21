import test from 'node:test';
import assert from 'node:assert/strict';
import { TourvisorClient } from '../src/hot-tours.js';

test('Tourvisor offers are normalized, budget-filtered and sorted', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ ok:true, async json(){ return { tours:[{id:3,price:'180 000 ₽',hotel:'C'},{id:2,price:'120000',hotel:'B'},{id:1,price:'99 000 ₽',hotel:'A'}] } } });
  try {
    const client = new TourvisorClient({ searchEndpoint:'https://example.test/search',token:'x',method:'POST',siteSearchUrl:'https://agency.test/tours',limit:3 });
    const result = await client.search({destination:'Турция',dates:'август',group:'2',budget:'150 000 ₽'});
    assert.deepEqual(result.map((tour) => tour.id), ['1', '2']);
    assert.equal(result[0].price,99000);
    assert.match(result[0].siteUrl,/tourId=1/);
  } finally { global.fetch = original; }
});

test('GET search passes subscription parameters in query string', async () => {
  const original = global.fetch;
  let requestedUrl;
  global.fetch = async (url) => { requestedUrl = String(url); return { ok:true, async json(){ return { tours:[] }; } }; };
  try {
    const client = new TourvisorClient({ searchEndpoint:'https://example.test/search',token:'x',method:'GET',siteSearchUrl:'https://agency.test/tours',limit:3 });
    await client.search({destination:'Египет',dates:'сентябрь',group:'2'});
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('destination'),'Египет');
    assert.equal(url.searchParams.get('group'),'2');
  } finally { global.fetch = original; }
});
