// Горящие туры берём из XML API Турвизора (hottours.php): авторизация через authlogin/authpass,
// ответ в JSON, город вылета и страна передаются числовыми кодами из справочников list.php.
const toNumber = (value) => Number(String(value ?? '').replace(/[^\d]/g, '')) || 0;
const text = (value) => String(value ?? '').trim();
const https = (value) => {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.toString() : '';
	} catch {
		return '';
	}
};
const norm = (value) => String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

const REFERENCE_TTL_MS = 86_400_000;
const TOUR_KEYS = ['price', 'tourprice', 'amount', 'hotelname', 'hotel', 'countryname'];

const CITY_ALIASES = {
	'нужен только отель без перелета': [],
	'только отель': [],
	'другой город': [],
	'не указан': []
};
const COUNTRY_ALIASES = {
	'россия и снг': ['россия'],
	'другое направление': [],
	'пока не определились': [],
	'не указано': []
};

// Формат ответа Турвизора отличается между методами, поэтому ищем массив туров на любом уровне.
function findRows(node, depth = 0) {
	if (!node || typeof node !== 'object' || depth > 6) return [];
	if (Array.isArray(node)) {
		const rows = node.filter((item) => item && typeof item === 'object' && TOUR_KEYS.some((key) => key in item));
		return rows;
	}
	for (const value of Object.values(node)) {
		const rows = findRows(value, depth + 1);
		if (rows.length) return rows;
	}
	return [];
}

function findRefs(node, type, depth = 0) {
	if (!node || typeof node !== 'object' || depth > 6) return [];
	if (Array.isArray(node)) return node.filter((item) => item && typeof item === 'object' && item.id !== undefined && item.name !== undefined);
	const entries = Object.entries(node);
	for (const [key, value] of entries) {
		if (norm(key).includes(type)) {
			const rows = findRefs(value, type, depth + 1);
			if (rows.length) return rows;
		}
	}
	for (const [, value] of entries) {
		const rows = findRefs(value, type, depth + 1);
		if (rows.length) return rows;
	}
	return [];
}

export class TourvisorClient {
	constructor(config, logger = console) {
		this.config = config;
		this.logger = logger;
		this.references = {};
	}

	get baseUrl() {
		return String(this.config.searchEndpoint || '').replace(/\/[^/]*$/, '');
	}

	get hotToursEndpoint() {
		return this.config.hotToursEndpoint || `${this.baseUrl}/hottours.php`;
	}

	get listEndpoint() {
		return this.config.listEndpoint || `${this.baseUrl}/list.php`;
	}

	async request(endpoint, params) {
		const url = new URL(endpoint);
		if (this.config.login) url.searchParams.set('authlogin', this.config.login);
		if (this.config.password) url.searchParams.set('authpass', this.config.password);
		url.searchParams.set('format', 'json');
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
		}
		const headers = { accept: 'application/json' };
		if (this.config.token) headers.Authorization = this.config.token;
		const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(30000) });
		if (!response.ok) throw new Error(`Tourvisor HTTP ${response.status}`);
		const body = await response.text();
		let data;
		try {
			data = body ? JSON.parse(body) : {};
		} catch {
			throw new Error(`Tourvisor returned a non-JSON response: ${body.slice(0, 200)}`);
		}
		if (data?.error || data?.result?.error) throw new Error(`Tourvisor error: ${text(data.error || data.result.error)}`);
		return data;
	}

	async reference(type) {
		const cached = this.references[type];
		if (cached && Date.now() - cached.at < REFERENCE_TTL_MS) return cached.items;
		let items = [];
		try {
			items = findRefs(await this.request(this.listEndpoint, { type }), type);
		} catch (error) {
			this.logger.warn?.('Tourvisor reference loading failed', { type, error: error.message });
		}
		this.references[type] = { at: Date.now(), items };
		return items;
	}

	async resolveCode(type, value, aliases) {
		const wanted = norm(value);
		if (!wanted) return '';
		const candidates = aliases[wanted] !== undefined ? aliases[wanted] : [wanted];
		if (!candidates.length) return '';
		const items = await this.reference(type);
		for (const candidate of candidates) {
			const hit = items.find((item) => norm(item.name) === candidate)
				|| items.find((item) => norm(item.name).startsWith(candidate) || candidate.startsWith(norm(item.name)));
			if (hit) return String(hit.id);
		}
		this.logger.warn?.('Tourvisor code not resolved', { type, value: text(value) });
		return '';
	}

	async search(params) {
		const city = (await this.resolveCode('departure', params.departureCity || params.city, CITY_ALIASES)) || this.config.defaultCity || '';
		const country = await this.resolveCode('country', params.destination, COUNTRY_ALIASES);
		const data = await this.request(this.hotToursEndpoint, {
			city,
			countries: country,
			items: Math.max(this.config.limit * 5, 10),
			picturelink: 1
		});
		const maxBudget = toNumber(params.budget);
		const seen = new Set();
		return findRows(data)
			.map((row) => this.normalize(row, params))
			.filter((tour) => {
				if (!tour.id || !tour.price) return false;
				if (maxBudget && tour.price > maxBudget) return false;
				if (seen.has(tour.id)) return false;
				seen.add(tour.id);
				return true;
			})
			.sort((a, b) => a.price - b.price)
			.slice(0, this.config.limit);
	}

	normalize(row, params) {
		const id = text(row.id ?? row.tourid ?? row.tourId ?? row.hotelcode ?? row.offer_id);
		const destination = text(row.countryname ?? row.destination ?? row.country ?? params.destination);
		const flyDate = text(row.flydate ?? row.dates ?? row.date);
		const nights = toNumber(row.nights);
		const dates = [flyDate, nights ? `${nights} ноч.` : ''].filter(Boolean).join(', ') || text(params.dates);
		const price = toNumber(row.price ?? row.tourprice ?? row.amount);
		const stars = toNumber(row.hotelstars);
		const hotel = [text(row.hotelname ?? row.hotel ?? row.name) || 'Тур', stars ? `${stars}★` : ''].filter(Boolean).join(' ');
		const operator = text(row.operatorname ?? row.operator ?? row.touroperator);
		const meal = text(row.meal ?? row.mealrussian);
		const directUrl = https(row.url ?? row.link ?? row.booking_url ?? row.tour_url ?? row.hoteldesclink);
		const site = new URL(this.config.siteSearchUrl);
		for (const [key, value] of Object.entries({
			tourId: id,
			destination,
			dates,
			group: params.group || '',
			hotel,
			price: String(price),
			operator
		})) site.searchParams.set(key, value);
		return {
			id,
			destination,
			dates,
			price,
			hotel,
			operator,
			meal,
			group: params.group,
			siteUrl: directUrl || site.toString(),
			agencyUrl: site.toString()
		};
	}
}

export class HotToursScheduler {
	constructor({ store, tourvisor, clients, hours, logger = console }) {
		Object.assign(this, { store, tourvisor, clients, hours, logger });
		this.lastRun = null;
	}

	start() {
		this.timer = setInterval(() => this.tick().catch((error) => this.logger.error('Hot tours job failed', { error: error.message })), 60000);
		this.tick().catch(() => {});
	}

	stop() {
		clearInterval(this.timer);
	}

	async tick(now = new Date()) {
		const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }).format(now));
		const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
		const runKey = `${day}:${hour}`;
		if (!this.hours.includes(hour) || this.lastRun === runKey) return;
		this.lastRun = runKey;
		await this.run();
	}

	async run() {
		for (const sub of this.store.listSubscriptions()) {
			try {
				const offers = await this.tourvisor.search(sub.params);
				const unseen = offers.filter((offer) => !(sub.sentOfferIds || []).includes(offer.id));
				for (const offer of unseen) {
					await this.store.saveOffer(offer);
					const output = {
						text: `🔥 Подходящее предложение\n\n🏨 ${offer.hotel}\n🌍 ${offer.destination}\n📅 ${offer.dates}\n👨‍👩‍👧‍👦 ${offer.group || 'Состав уточняется'}\n💳 от ${offer.price.toLocaleString('ru-RU')} ₽${offer.meal ? `\n🍴 ${offer.meal}` : ''}${offer.operator ? `\n✈️ ${offer.operator}` : ''}\n\nЦена и наличие меняются. Бронирование и передача контактных данных выполняются только на сайте турагентства.`,
						buttons: [
							[{ text: 'Открыть и забронировать на сайте', url: offer.agencyUrl || offer.siteUrl }],
							[{ text: 'Остановить рассылку', callback: 'stop' }]
						]
					};
					await this.clients[sub.platform].send(sub.userId, output);
				}
				await this.store.markSubscriptionSent(sub.id, unseen.map((offer) => offer.id));
			} catch (error) {
				this.logger.error('Subscription failed', { subscriptionId: sub.id, error: error.message });
			}
		}
	}
}
