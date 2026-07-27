import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramClient } from '../src/platforms.js';

const silentLogger = { warn: () => {}, error: () => {}, info: () => {} };

const withFetch = async (impl, run) => {
	const original = globalThis.fetch;
	globalThis.fetch = impl;
	try { return await run(); } finally { globalThis.fetch = original; }
};

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: true }) });

test('по умолчанию запросы идут на api.telegram.org', async () => {
	const calls = [];
	await withFetch(async (url) => { calls.push(url); return okResponse(); }, async () => {
		const client = new TelegramClient({ token: 'T0KEN' }, silentLogger);
		await client.send('42', { text: 'Привет' });
	});
	assert.equal(calls[0], 'https://api.telegram.org/botT0KEN/sendMessage');
});

test('TELEGRAM_API_BASE переключает вызовы на зеркало', async () => {
	const calls = [];
	await withFetch(async (url) => { calls.push(url); return okResponse(); }, async () => {
		const client = new TelegramClient({ token: 'T0KEN', apiBase: 'https://tg-proxy.example.com/' }, silentLogger);
		await client.send('42', { text: 'Привет', buttons: [[{ text: 'Меню', callback: 'menu' }]] });
		await client.ack('cb-1');
		await client.configure();
	});
	assert.equal(calls[0], 'https://tg-proxy.example.com/botT0KEN/sendMessage');
	assert.equal(calls[1], 'https://tg-proxy.example.com/botT0KEN/answerCallbackQuery');
	assert.equal(calls[2], 'https://tg-proxy.example.com/botT0KEN/setMyCommands');
	assert.equal(calls[3], 'https://tg-proxy.example.com/botT0KEN/setChatMenuButton');
});

test('сетевая ошибка обясняет, что нужно зеркало или прокси', async () => {
	await withFetch(async () => { throw new Error('fetch failed'); }, async () => {
		const client = new TelegramClient({ token: 'T0KEN' }, silentLogger);
		await assert.rejects(() => client.send('42', { text: 'Привет' }), /TELEGRAM_API_BASE/);
	});
});
