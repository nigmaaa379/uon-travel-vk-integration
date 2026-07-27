import test from 'node:test';
import assert from 'node:assert/strict';
import { HotToursScheduler, buildSearchLink } from '../src/hot-tours.js';

const silentLogger = { warn: () => {}, error: () => {}, info: () => {} };
const searchPageUrl = 'https://tursbezhimnamore.ru/#search';

const makeScheduler = (tourvisor, subscription) => {
	const sent = [];
	const store = {
		listSubscriptions: () => [subscription],
		saveOffer: async () => {},
		markSubscriptionSent: async () => {}
	};
	const clients = { max: { send: async (userId, output) => sent.push({ userId, output }) } };
	const scheduler = new HotToursScheduler({ store, tourvisor, clients, hours: [9], searchPageUrl, logger: silentLogger });
	return { scheduler, sent };
};

const subscription = {
	id: 'sub-1',
	platform: 'max',
	userId: '77',
	params: { departureCity: 'Санкт-Петербург', destination: 'Вьетнам', dates: 'Осень-зима 2026/2027', group: '2 взрослых' },
	sentOfferIds: []
};

test('ссылка на поиск получает параметры подписки', () => {
	const url = new URL(buildSearchLink(searchPageUrl, subscription.params));
	assert.equal(url.searchParams.get('departure'), 'Санкт-Петербург');
	assert.equal(url.searchParams.get('country'), 'Вьетнам');
	assert.equal(url.searchParams.get('when'), 'Осень-зима 2026/2027');
	assert.equal(url.searchParams.get('utm_campaign'), 'hot-tours');
	assert.equal(url.hash, '#search');
});

test('служебные значения не попадают в ссылку', () => {
	const url = new URL(buildSearchLink(searchPageUrl, { departureCity: 'Другой город', destination: 'Другое направление', dates: 'Другие даты' }));
	assert.equal(url.searchParams.get('departure'), null);
	assert.equal(url.searchParams.get('country'), null);
	assert.equal(url.searchParams.get('when'), null);
});

test('без API Турвизора подписчик получает ссылку на поиск на сайте', async () => {
	const { scheduler, sent } = makeScheduler(null, subscription);
	await scheduler.run();
	assert.equal(sent.length, 1);
	assert.match(sent[0].output.text, /горящие предложения/i);
	assert.match(sent[0].output.text, /Вьетнам/);
	assert.match(sent[0].output.buttons[0][0].url, /departure=/);
	assert.equal(sent[0].output.buttons.at(-1)[0].callback, 'stop');
});

test('ошибка авторизации Турвизора переводит рассылку на ссылки', async () => {
	const tourvisor = { search: async () => { throw new Error('Tourvisor authorization failed: проверьте доступы'); } };
	const { scheduler, sent } = makeScheduler(tourvisor, subscription);
	await scheduler.run();
	assert.equal(sent.length, 1);
	assert.match(sent[0].output.buttons[0][0].url, /tursbezhimnamore\.ru/);
	assert.equal(scheduler.apiDisabled, true);
});

test('при рабочем API отправляются конкретные предложения', async () => {
	const tourvisor = {
		search: async () => [{ id: '1', hotel: 'A 4★', destination: 'Вьетнам', dates: '10.10.2026, 7 ноч.', price: 99000, group: '2 взрослых', meal: 'Всё включено', operator: 'Pegas', agencyUrl: 'https://tursbezhimnamore.ru/tours?tourId=1' }]
	};
	const { scheduler, sent } = makeScheduler(tourvisor, subscription);
	await scheduler.run();
	assert.equal(sent.length, 1);
	assert.match(sent[0].output.text, /99 000/);
	assert.match(sent[0].output.buttons[0][0].url, /tourId=1/);
});
