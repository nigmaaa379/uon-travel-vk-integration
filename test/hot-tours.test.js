import test from 'node:test';
import assert from 'node:assert/strict';
import { TourvisorClient } from '../src/hot-tours.js';

const silentLogger = { warn: () => {}, error: () => {}, info: () => {} };
const config = {
	searchEndpoint: 'https://tourvisor.ru/xml/search.php',
	login: 'agency@example.test',
	password: 'secret',
	token: 'secret',
	siteSearchUrl: 'https://agency.test/tours',
	limit: 3
};
const lists = {
	lists: {
		departures: { departure: [{ id: 1, name: 'Москва' }, { id: 5, name: 'Санкт-Петербург' }] },
		countries: { country: [{ id: 4, name: 'Турция' }, { id: 1, name: 'Египет' }] }
	}
};
const hotTours = {
	hottours: {
		hottour: [
			{ hotelcode: 3, hotelname: 'C', hotelstars: 5, countryname: 'Турция', flydate: '15.10.2026', nights: 7, price: '180000', operatorname: 'Pegas', meal: 'Все включено' },
			{ hotelcode: 2, hotelname: 'B', hotelstars: 4, countryname: 'Турция', flydate: '12.10.2026', nights: 10, price: '120 000' },
			{ hotelcode: 1, hotelname: 'A', hotelstars: 3, countryname: 'Турция', flydate: '10.10.2026', nights: 7, price: '99 000 ₽' }
		]
	}
};

const stubFetch = (routes) => {
	const calls = [];
	global.fetch = async (url) => {
		const value = String(url);
		calls.push(value);
		const body = value.includes('list.php') ? routes.lists : routes.hot;
		return { ok: true, async text() { return JSON.stringify(body); } };
	};
	return calls;
};

test('горящие туры запрашиваются через hottours.php с кодами города и страны', async () => {
	const original = global.fetch;
	const calls = stubFetch({ lists, hot: hotTours });
	try {
		const client = new TourvisorClient(config, silentLogger);
		const offers = await client.search({ departureCity: 'Москва', destination: 'Турция', dates: 'октябрь', group: '2 взрослых' });
		const hotUrl = new URL(calls.find((value) => value.includes('hottours.php')));
		assert.equal(hotUrl.pathname, '/xml/hottours.php');
		assert.equal(hotUrl.searchParams.get('authlogin'), 'agency@example.test');
		assert.equal(hotUrl.searchParams.get('authpass'), 'secret');
		assert.equal(hotUrl.searchParams.get('format'), 'json');
		assert.equal(hotUrl.searchParams.get('city'), '1');
		assert.equal(hotUrl.searchParams.get('countries'), '4');
		assert.deepEqual(offers.map((offer) => offer.id), ['1', '2', '3']);
		assert.equal(offers[0].price, 99000);
		assert.equal(offers[0].hotel, 'A 3★');
		assert.equal(offers[0].dates, '10.10.2026, 7 ноч.');
		assert.match(offers[0].agencyUrl, /tourId=1/);
		assert.equal(offers[2].meal, 'Все включено');
	} finally {
		global.fetch = original;
	}
});

test('бюджет ограничивает подборку, цены сортируются по возрастанию', async () => {
	const original = global.fetch;
	stubFetch({ lists, hot: hotTours });
	try {
		const client = new TourvisorClient(config, silentLogger);
		const offers = await client.search({ departureCity: 'Москва', destination: 'Турция', budget: '150 000 ₽' });
		assert.deepEqual(offers.map((offer) => offer.id), ['1', '2']);
	} finally {
		global.fetch = original;
	}
});

test('нераспознанное направление не ломает запрос', async () => {
	const original = global.fetch;
	const calls = stubFetch({ lists, hot: hotTours });
	try {
		const client = new TourvisorClient(config, silentLogger);
		const offers = await client.search({ departureCity: 'Нужен только отель, без перелёта', destination: 'Другое направление' });
		const hotUrl = new URL(calls.find((value) => value.includes('hottours.php')));
		assert.equal(hotUrl.searchParams.get('countries'), null);
		assert.equal(hotUrl.searchParams.get('city'), null);
		assert.equal(offers.length, 3);
	} finally {
		global.fetch = original;
	}
});

test('не-JSON ответ Турвизора даёт понятную ошибку', async () => {
	const original = global.fetch;
	global.fetch = async () => ({ ok: true, async text() { return '<?xml version="1.0"?><data/>'; } });
	try {
		const client = new TourvisorClient(config, silentLogger);
		await assert.rejects(() => client.search({ departureCity: 'Москва', destination: 'Турция' }), /non-JSON/);
	} finally {
		global.fetch = original;
	}
});
