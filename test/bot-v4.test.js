import test from 'node:test';
import assert from 'node:assert/strict';
import { BotCore } from '../src/bot-core-v4.js';

const silentLogger = { warn: () => {}, error: () => {}, info: () => {} };

const makeCore = (uonOverrides = {}) => {
	const sessions = {};
	const leads = [];
	const fallbackLeads = [];
	const subscriptions = [];
	const store = {
		touchBotUser: async () => {},
		getBotSession: (k) => sessions[k] || null,
		saveBotSession: async (k, v) => { sessions[k] = v; },
		clearBotSession: async (k) => { delete sessions[k]; },
		saveConsentEvidence: async () => {},
		addSubscription: async ({ platform, userId, params, consent }) => {
			const item = { id: String(subscriptions.length + 1), platform, userId: String(userId), params, consent, active: true };
			subscriptions.push(item);
			return item;
		},
		listSubscriptions: () => subscriptions.filter((item) => item.active),
		deactivateSubscriptions: async (platform, userId) => {
			let count = 0;
			for (const item of subscriptions) {
				if (item.platform === platform && String(item.userId) === String(userId) && item.active) { item.active = false; count += 1; }
			}
			return count;
		}
	};
	const uon = {
		createQualifiedLead: async (t) => { leads.push(t); return { id: 777 }; },
		createLead: async (t) => { fallbackLeads.push(t); return { id: 888 }; },
		...uonOverrides
	};
	const core = new BotCore({ store, uon, notifier: { notify: async () => ({ ok: true }) }, logger: silentLogger });
	return { core, store, leads, fallbackLeads, subscriptions };
};

const startQualification = async (core) => {
	await core.handle('max', '1', { callback: 'qualify' });
	await core.handle('max', '1', { callback: 'consent:pd' });
	return core.handle('max', '1', { callback: 'consent:travel' });
};

const walkToContacts = async (core) => {
	await startQualification(core);
	await core.handle('max', '1', { callback: 'v4:city:Москва' });
	await core.handle('max', '1', { callback: 'a:Турция' });
	await core.handle('max', '1', { callback: 'a:Осень-зима 2026/2027' });
	return core.handle('max', '1', { callback: 'a:2 взрослых + 1 ребёнок' });
};

const walkSubscription = async (core, options = {}) => {
	const { city = 'Москва', destination = 'Турция', dates = 'Ближайшие 2–4 недели', group = '2 взрослых' } = options;
	await core.handle('max', '1', { callback: 'subscribe' });
	await core.handle('max', '1', { callback: 'consent:ads' });
	await core.handle('max', '1', { callback: `v4:city:${city}` });
	await core.handle('max', '1', { callback: `a:${destination}` });
	await core.handle('max', '1', { callback: `a:${dates}` });
	return core.handle('max', '1', { callback: `a:${group}` });
};

test('короткий сценарий: город, направление, даты, состав, имя и телефон', async () => {
	const { core, store, leads } = makeCore();
	const cities = await startQualification(core);
	assert.match(cities.text, /города/);
	assert.ok(cities.buttons.flat().some((x) => x.text === 'Нужен только отель'));

	const destination = await core.handle('max', '1', { callback: 'v4:city:Москва' });
	assert.ok(destination.buttons.flat().some((x) => x.text === 'Россия и СНГ'));
	assert.ok(destination.buttons.flat().some((x) => x.text === 'Шри-Ланка'));

	const dates = await core.handle('max', '1', { callback: 'a:Турция' });
	assert.ok(dates.buttons.flat().some((x) => x.text === 'Ближайшие 2–4 недели'));
	assert.ok(dates.buttons.flat().some((x) => x.text === 'Осень-зима 2026/2027'));

	// Бюджет пропускаем: сразу спрашиваем состав.
	const group = await core.handle('max', '1', { callback: 'a:Осень-зима 2026/2027' });
	assert.match(group.text, /составе/);
	assert.ok(group.buttons.flat().some((x) => x.text === '2 взрослых + 1 ребёнок'));

	const contacts = await core.handle('max', '1', { callback: 'a:2 взрослых + 1 ребёнок' });
	assert.match(contacts.text, /номер телефона/);
	assert.equal(store.getBotSession('max:1').state, '_contacts');

	const waitPhone = await core.handle('max', '1', { text: 'Любовь' });
	assert.match(waitPhone.text, /Любовь/);
	assert.equal(store.getBotSession('max:1').answers.name, 'Любовь');

	const done = await core.handle('max', '1', { text: '+79201242033' });
	assert.match(done.text, /Заявка №777/);
	assert.equal(store.getBotSession('max:1'), null);
	assert.equal(leads.length, 1);
	assert.equal(leads[0].name, 'Любовь');
	assert.equal(leads[0].phone, '+79201242033');
	assert.equal(leads[0].destination, 'Турция');
	assert.equal(leads[0].dates, 'Осень-зима 2026/2027');
	assert.equal(leads[0].platform, 'max');
	assert.equal(String(leads[0].messengerUserId), '1');
	assert.match(leads[0].wishes, /Город вылета: Москва/);
});

test('имя и телефон принимаются одним сообщением', async () => {
	const { core, leads } = makeCore();
	await startQualification(core);
	await core.handle('max', '1', { callback: 'v4:city:Казань' });
	await core.handle('max', '1', { callback: 'a:Египет' });
	await core.handle('max', '1', { callback: 'a:Ближайшие 2–4 недели' });
	await core.handle('max', '1', { callback: 'a:2 взрослых' });
	const done = await core.handle('max', '1', { text: 'Любовь, 8 920 124 20 33' });
	assert.match(done.text, /Заявка №777/);
	assert.equal(leads[0].name, 'Любовь');
	assert.equal(leads[0].phone, '+79201242033');
});

test('если createQualifiedLead падает, заявка уходит в U-ON форматом раздела 1', async () => {
	const { core, fallbackLeads } = makeCore({ createQualifiedLead: async () => { throw new Error('HTTP 422'); } });
	await walkToContacts(core);
	const done = await core.handle('max', '1', { text: 'Любовь +79201242033' });
	assert.match(done.text, /Заявка №888/);
	assert.equal(fallbackLeads.length, 1);
	assert.equal(fallbackLeads[0].name, 'Любовь');
	assert.equal(fallbackLeads[0].phone, '+79201242033');
	assert.equal(fallbackLeads[0].travelers, '2 взрослых + 1 ребёнок');
	assert.match(fallbackLeads[0].vkUserId, /max:1/);
});

test('при полном отказе U-ON сессия сохраняется для повтора', async () => {
	const { core, store } = makeCore({
		createQualifiedLead: async () => { throw new Error('HTTP 500'); },
		createLead: async () => { throw new Error('HTTP 500'); }
	});
	await walkToContacts(core);
	const failed = await core.handle('max', '1', { text: 'Любовь +79201242033' });
	assert.match(failed.text, /Не удалось/);
	assert.equal(store.getBotSession('max:1').state, '_contacts');
	assert.equal(store.getBotSession('max:1').answers.phone, '+79201242033');
});

test('вариант «Другие даты» просит написать даты сообщением', async () => {
	const { core, store } = makeCore();
	await startQualification(core);
	await core.handle('max', '1', { callback: 'v4:city:Сочи' });
	await core.handle('max', '1', { callback: 'a:Таиланд' });
	const ask = await core.handle('max', '1', { callback: 'a:Другие даты' });
	assert.match(ask.text, /Напишите/);
	assert.equal(store.getBotSession('max:1').state, 'dates');
	const group = await core.handle('max', '1', { text: 'октябрь' });
	assert.match(group.text, /составе/);
	assert.equal(store.getBotSession('max:1').answers.dates, 'октябрь');
});

test('текст города вылета не сбрасывает диалог в меню', async () => {
	const { core, store } = makeCore();
	await startQualification(core);
	const destination = await core.handle('max', '1', { text: 'Ярославль' });
	assert.match(destination.text, /направление/);
	assert.equal(store.getBotSession('max:1').answers.departureCity, 'Ярославль');
});

test('подписка на горящие сохраняется и показывается при повторном нажатии', async () => {
	const { core, subscriptions } = makeCore();
	const saved = await walkSubscription(core);
	assert.match(saved.text, /Рассылка горящих предложений настроена/);
	assert.match(saved.text, /Турция/);
	assert.match(saved.text, /Москва/);
	assert.equal(subscriptions.length, 1);

	const again = await core.handle('max', '1', { callback: 'subscribe' });
	assert.match(again.text, /уже подключена/);
	assert.match(again.text, /Турция/);
	assert.ok(again.buttons.flat().some((x) => x.callback === 'v4:sub:edit'));
	assert.ok(again.buttons.flat().some((x) => x.callback === 'stop'));
	assert.equal(subscriptions.filter((item) => item.active).length, 1);
});

test('изменение параметров не спрашивает согласие заново и отключает старую подписку', async () => {
	const { core, subscriptions } = makeCore();
	await walkSubscription(core);
	const edit = await core.handle('max', '1', { callback: 'v4:sub:edit' });
	assert.match(edit.text, /Обновим параметры/);
	assert.ok(edit.buttons.flat().some((x) => x.callback === 'v4:city:Казань'));

	await core.handle('max', '1', { callback: 'v4:city:Казань' });
	await core.handle('max', '1', { callback: 'a:Египет' });
	await core.handle('max', '1', { callback: 'a:Осень-зима 2026/2027' });
	const updated = await core.handle('max', '1', { callback: 'a:2 взрослых + 1 ребёнок' });
	assert.match(updated.text, /Египет/);

	const active = subscriptions.filter((item) => item.active);
	assert.equal(active.length, 1);
	assert.equal(active[0].params.destination, 'Египет');
	assert.equal(active[0].params.departureCity, 'Казань');
	assert.equal(active[0].consent.marketingConsent, true);
});

test('после остановки рассылки подписку можно оформить заново', async () => {
	const { core } = makeCore();
	await walkSubscription(core);
	const stopped = await core.handle('max', '1', { callback: 'stop' });
	assert.match(stopped.text, /остановлена/);
	const fresh = await core.handle('max', '1', { callback: 'subscribe' });
	assert.match(fresh.text, /согласие/);
});
