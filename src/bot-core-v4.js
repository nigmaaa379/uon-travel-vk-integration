import { BotCore as BaseBotCore } from './bot-core-v3.js';
import { normalizePhone } from './qualification.js';

const SITE = 'https://tursbezhimnamore.ru';
const V = '2026-07-26';
const b = (text, callback) => ({ text, callback });
const u = (text, url) => ({ text, url });
const MENU = [[b('🏠 В меню', 'menu')]];
const DEPARTURE_STATES = ['_departureLead', '_departureSub'];
const CONTACTS_STATE = '_contacts';
const BUDGET_PLACEHOLDER = 'Уточняется менеджером в диалоге';

// Уточняющие ответы: вариант «Другое …» не должен идти дальше по сценарию,
// сначала просим написать значение сообщением.
const ASK_TEXT = {
	'Другое направление': 'Напишите, пожалуйста, направление сообщением — страну или курорт.',
	'Другие даты': 'Напишите, пожалуйста, даты или месяц сообщением — например «октябрь» или «10–20 августа».',
	'Другой состав': 'Напишите, пожалуйста, состав сообщением: сколько взрослых и возраст детей.'
};
const ASK_TEXT_STATES = { destination: 1, dates: 1, group: 1 };

const cityPrompt = () => ({
	text: 'Из какого города планируете вылет? Выберите вариант или напишите город сообщением.',
	buttons: [
		[b('Москва', 'v4:city:Москва'), b('Санкт-Петербург', 'v4:city:Санкт-Петербург')],
		[b('Казань', 'v4:city:Казань'), b('Екатеринбург', 'v4:city:Екатеринбург')],
		[b('Сочи', 'v4:city:Сочи'), b('Новосибирск', 'v4:city:Новосибирск')],
		[b('Другой город', 'v4:city:Другой город')],
		[b('Нужен только отель', 'v4:city:Только отель')]
	]
});

const destinationButtons = [
	[b('Россия и СНГ', 'a:Россия и СНГ'), b('Турция', 'a:Турция')],
	[b('Египет', 'a:Египет'), b('ОАЭ', 'a:ОАЭ')],
	[b('Таиланд', 'a:Таиланд'), b('Вьетнам', 'a:Вьетнам')],
	[b('Китай', 'a:Китай'), b('Шри-Ланка', 'a:Шри-Ланка')],
	[b('Другое направление', 'a:Другое направление')]
];
const destinationPrompt = () => ({
	text: 'Какое направление рассматриваете в первую очередь? Выберите вариант или напишите своё.',
	buttons: destinationButtons
});

const datesButtons = [
	[b('Ближайшие 2–4 недели', 'a:Ближайшие 2–4 недели')],
	[b('Осень-зима 2026/2027', 'a:Осень-зима 2026/2027')],
	[b('Другие даты', 'a:Другие даты')]
];
const datesPrompt = (text) => ({ text, buttons: datesButtons });

const groupButtons = [
	[b('1 взрослый', 'a:1 взрослый'), b('2 взрослых', 'a:2 взрослых')],
	[b('2 взрослых + 1 ребёнок', 'a:2 взрослых + 1 ребёнок')],
	[b('2 взрослых + 2 ребёнка', 'a:2 взрослых + 2 ребёнка')],
	[b('Другой состав', 'a:Другой состав')]
];
const groupPrompt = () => ({
	text: 'В каком составе планируете поездку? Выберите вариант или напишите свой.',
	buttons: groupButtons
});

const contactsPrompt = () => ({
	text: [
		'Спасибо! Уже подбираем варианты, которые подойдут именно вам 🌴',
		'',
		'Чтобы получить подборку туров и уточнить все вопросы у менеджера, напишите одним сообщением, как к вам обращаться и ваш номер телефона: +7XXXXXXXXXX',
		'',
		'Мы гарантируем, что:',
		'✅ не звоним без вашего согласия',
		'✅ не присылаем рассылок в мессенджер',
		'✅ не передаём ваш номер телефона третьим лицам'
	].join('\n'),
	buttons: MENU
});

const managerPrompt = () => {
	const maxUrl = process.env.MANAGER_MAX_URL?.trim();
	const buttons = [];
	if (maxUrl) buttons.push([u('Написать в MAX', maxUrl)]);
	buttons.push([u('Открыть сайт', SITE)]);
	buttons.push([b('🏠 В меню', 'menu')]);
	return {
		text: '💬 Менеджер\n\n+7 (920) 124-20-33\nl_g_goreva@mail.ru\nПн–Сб, 10:00–19:00 по Москве.',
		buttons
	};
};

// Кнопки управления уже настроенной рассылкой горящих туров.
const subscriptionButtons = () => [
	[b('✏️ Изменить параметры', 'v4:sub:edit')],
	[b('⏹ Остановить рассылку', 'stop')],
	[b('🏠 В меню', 'menu')]
];

const subscriptionSummary = (params = {}) => [
	params.departureCity ? `✈️ Вылет: ${params.departureCity}` : null,
	params.destination ? `🌍 Направление: ${params.destination}` : null,
	params.dates ? `📅 Даты: ${params.dates}` : null,
	params.group ? `👨‍👩‍👧 Состав: ${params.group}` : null
].filter(Boolean).join('\n');

const activeSubscriptionCard = (params) => ({
	text: [
		'🔥 Рассылка горящих предложений у вас уже подключена.',
		'',
		'Сейчас подбираем по параметрам:',
		subscriptionSummary(params) || 'Параметры не указаны',
		'',
		'Свежие варианты приходят до трёх раз в день. Повторно подписываться не нужно — можно изменить параметры или остановить рассылку.'
	].join('\n'),
	buttons: subscriptionButtons()
});

const subscriptionSavedCard = (params) => ({
	text: [
		'✅ Рассылка горящих предложений настроена.',
		'',
		subscriptionSummary(params) || 'Параметры не указаны',
		'',
		'Будем присылать подходящие варианты до трёх раз в день. Цена и наличие подтверждаются менеджером перед бронированием.'
	].join('\n'),
	buttons: [[b('🔎 Подобрать тур сейчас', 'qualify')], ...subscriptionButtons()]
});

const PHONE_RE = /(?:\+?7|8)?[\s\-()]*\d[\d\s\-()]{8,}/;
const cleanName = (value) => value.replace(/[,;:.!?]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export class BotCore extends BaseBotCore {
	constructor(deps) {
		const uon = {
			createQualifiedLead: (t) => deps.uon.createQualifiedLead({
				...t,
				wishes: `Город вылета: ${t.departureCity || 'не указан'}\n${t.wishes || ''}`.trim()
			})
		};
		super({ ...deps, uon });
		this.v4Store = deps.store;
		this.rawUon = deps.uon;
		this.v4Logger = deps.logger || console;
	}

	async patch(key, session, changes) {
		const next = { ...session, ...changes, updatedAt: Date.now() };
		await this.v4Store.saveBotSession(key, next);
		return next;
	}

	async setDepartureCity(key, session, departureCity) {
		await this.patch(key, session, { state: 'destination', answers: { ...session.answers, departureCity } });
		return destinationPrompt();
	}

	// Активная подписка этого пользователя, если она уже есть.
	findSubscription(platform, userId) {
		const list = this.v4Store.listSubscriptions?.() || [];
		return list.filter((item) => item.platform === platform && String(item.userId) === String(userId)).pop() || null;
	}

	// Изменение параметров: согласие на рассылку уже получено, повторно не спрашиваем.
	async startSubscriptionEdit(key, platform, userId) {
		const existing = this.findSubscription(platform, userId);
		const adsAt = existing?.consent?.receivedAt || new Date().toISOString();
		await this.v4Store.saveBotSession(key, {
			flow: 'sub',
			state: '_departureSub',
			answers: { ads: true, adsAt },
			updatedAt: Date.now()
		});
		const prompt = cityPrompt();
		return { ...prompt, text: `Обновим параметры рассылки.\n\n${prompt.text}` };
	}

	// Перед сохранением новых параметров отключаем прежние подписки,
	// иначе одному человеку уходили бы дубли по старым и новым параметрам.
	async subscription(key, platform, userId, session, value) {
		if (session.state === 'group') await this.v4Store.deactivateSubscriptions?.(platform, userId);
		return super.subscription(key, platform, userId, session, value);
	}

	async collectContacts(key, platform, userId, session, value) {
		const match = String(value).match(PHONE_RE);
		const phone = match ? normalizePhone(match[0]) : null;
		const typedName = cleanName(match ? String(value).replace(match[0], ' ') : String(value));
		const answers = { ...session.answers };
		if (typedName) answers.name = typedName;
		if (phone) answers.phone = phone;
		if (match && !phone) {
			await this.patch(key, session, { answers });
			return { text: 'Проверьте, пожалуйста, номер телефона. Пример: +79991234567.', buttons: MENU };
		}
		if (!answers.name) {
			await this.patch(key, session, { answers });
			return { text: 'Как к вам обращаться? Напишите имя сообщением.', buttons: MENU };
		}
		if (!answers.phone) {
			await this.patch(key, session, { answers });
			return {
				text: `Спасибо, ${answers.name}! Напишите номер телефона в формате +7XXXXXXXXXX — менеджер отправит подборку.`,
				buttons: MENU
			};
		}
		return this.createLead(key, platform, userId, { ...session, answers });
	}

	// Заявка в U-ON. Основной вызов — createQualifiedLead, резервный — тот же формат полей,
	// что работает в разделе 1 (ветка VK, UonClient.createLead).
	async createUonLead(platform, userId, answers) {
		try {
			return await this.uon.createQualifiedLead({ ...answers, platform, messengerUserId: userId });
		} catch (error) {
			this.v4Logger.error('U-ON qualified lead creation failed', { platform, userId: String(userId), error: error.message });
			const lead = await this.rawUon.createLead({
				name: answers.name,
				phone: answers.phone,
				email: answers.email,
				destination: answers.destination || 'Не указано',
				dates: answers.dates || 'Уточнить',
				travelers: answers.group || 'Уточнить',
				budget: answers.budget || BUDGET_PLACEHOLDER,
				vkUserId: `${platform}:${userId} (город вылета: ${answers.departureCity || 'не указан'})`
			});
			this.v4Logger.warn('U-ON lead created with fallback payload', { platform, leadId: String(lead.id) });
			return lead;
		}
	}

	async createLead(key, platform, userId, session) {
		const { pd: personalConsent, travel: countryInfoAcknowledged, ...answers } = session.answers;
		let lead;
		try {
			lead = await this.createUonLead(platform, userId, answers);
		} catch (error) {
			this.v4Logger.error('U-ON lead creation failed', { platform, userId: String(userId), error: error.message });
			await this.patch(key, session, { state: CONTACTS_STATE });
			return {
				text: 'Не удалось передать заявку менеджеру. Отправьте номер телефона ещё раз или позвоните нам: +7 (920) 124-20-33.',
				buttons: [[b('💬 Связаться с менеджером', 'manager')], [b('🏠 В меню', 'menu')]]
			};
		}
		// Согласие и уведомления не должны ломать уже созданную заявку.
		try {
			await this.v4Store.saveConsentEvidence({
				receivedAt: new Date().toISOString(),
				channel: platform,
				messengerUserId: String(userId),
				consentType: 'personal',
				personalConsent: Boolean(personalConsent),
				countryInfoAcknowledged: Boolean(countryInfoAcknowledged),
				consentVersion: V,
				privacyPolicyVersion: V,
				travelInformationVersion: V,
				uonLeadId: String(lead.id)
			});
		} catch (error) {
			this.v4Logger.error('Consent evidence saving failed', { platform, leadId: String(lead.id), error: error.message });
		}
		try {
			const delivery = await this.notifier.notify(lead.id);
			if (delivery && delivery.ok === false) this.v4Logger.error('Lead notification delivery failed', { platform, leadId: String(lead.id), delivery });
		} catch (error) {
			this.v4Logger.error('Lead notification failed', { platform, leadId: String(lead.id), error: error.message });
		}
		await this.v4Store.clearBotSession(key);
		const subscribed = Boolean(this.findSubscription(platform, userId));
		return {
			text: `✅ Спасибо! Заявка №${lead.id} принята. Менеджер подберёт варианты и свяжется с вами.`,
			buttons: [
				subscribed ? [b('🔥 Моя рассылка горящих', 'subscribe')] : [b('🔥 Получать горящие предложения', 'subscribe')],
				[b('💬 Связаться с менеджером', 'manager')],
				[b('🏠 В меню', 'menu')]
			]
		};
	}

	async handle(platform, userId, input = {}) {
		const key = `${platform}:${userId}`;
		const before = this.v4Store.getBotSession(key);
		const action = String(input.callback || '');
		const typed = String(input.text || '').trim();
		const answerValue = action.startsWith('a:') ? action.slice(2) : typed;
		const freeAnswer = (!action || action.startsWith('a:')) && !typed.startsWith('/');

		// Повторное нажатие «Горящие предложения» не должно гонять человека
		// по кругу с согласием: показываем уже сохранённые параметры.
		if (action === 'subscribe' || typed.toLowerCase().startsWith('/hot')) {
			const existing = this.findSubscription(platform, userId);
			if (existing) {
				await this.v4Store.clearBotSession(key);
				return activeSubscriptionCard(existing.params);
			}
		}
		if (action === 'v4:sub:edit') return this.startSubscriptionEdit(key, platform, userId);

		if (action.startsWith('v4:city:')) {
			const departureCity = action.slice(8);
			const session = this.v4Store.getBotSession(key);
			if (!session || !DEPARTURE_STATES.includes(session.state)) return super.handle(platform, userId, { text: '/start' });
			if (departureCity === 'Другой город') return { text: 'Напишите, пожалуйста, город вылета сообщением.', buttons: MENU };
			if (departureCity === 'Только отель') return this.setDepartureCity(key, session, 'Нужен только отель, без перелёта');
			return this.setDepartureCity(key, session, departureCity);
		}

		// Город вылета можно написать текстом: без этого служебное состояние сбрасывало диалог в главное меню.
		if (freeAnswer && typed && DEPARTURE_STATES.includes(before?.state)) return this.setDepartureCity(key, before, typed.slice(0, 120));

		// Имя и телефон принимаем одним сообщением, email больше не спрашиваем.
		if (freeAnswer && before?.state === CONTACTS_STATE) {
			if (!answerValue) return { text: 'Напишите, пожалуйста, имя и номер телефона одним сообщением.', buttons: MENU };
			return this.collectContacts(key, platform, userId, before, answerValue);
		}

		if (freeAnswer && ASK_TEXT[answerValue] && ASK_TEXT_STATES[before?.state]) {
			return { text: ASK_TEXT[answerValue], buttons: MENU };
		}

		const output = await super.handle(platform, userId, input);
		const after = this.v4Store.getBotSession(key);

		if (action === 'consent:travel' && before?.flow === 'lead' && after?.state === 'destination') {
			await this.patch(key, after, { state: '_departureLead' });
			return cityPrompt();
		}
		if (action === 'consent:ads' && before?.flow === 'sub' && after?.state === 'destination') {
			await this.patch(key, after, { state: '_departureSub' });
			return cityPrompt();
		}

		// Бюджет не спрашиваем — менеджер уточняет его в живом диалоге.
		if (after?.state === 'budget') {
			await this.patch(key, after, { state: 'group', answers: { ...after.answers, budget: BUDGET_PLACEHOLDER } });
			return groupPrompt();
		}
		// Пожелания и email тоже убраны: после состава сразу просим имя и телефон.
		if (after?.state === 'wishes' && after.flow === 'lead') {
			await this.patch(key, after, { state: CONTACTS_STATE, answers: { ...after.answers, wishes: '' } });
			return contactsPrompt();
		}

		// Подтверждение подписки показываем вместе с сохранёнными параметрами.
		if (output?.text?.startsWith('✅ Подписка настроена')) {
			const saved = this.findSubscription(platform, userId);
			return subscriptionSavedCard(saved?.params || { ...before?.answers, group: answerValue });
		}

		if (output?.text?.startsWith('Куда хотите отправиться')) return { ...output, ...destinationPrompt() };
		if (output?.text?.startsWith('Когда планируете поездку')) {
			return { ...output, ...datesPrompt('Когда планируете поездку? Выберите вариант или напишите месяц либо даты сообщением.') };
		}
		if (output?.text?.startsWith('Укажите диапазон дат')) {
			return { ...output, ...datesPrompt('На какой период искать горящие туры? Выберите вариант или напишите месяц сообщением.') };
		}
		if (output?.text?.startsWith('Кто отправится')) return { ...output, ...groupPrompt() };
		if (output?.text?.startsWith('💬 Менеджер')) return { ...output, ...managerPrompt() };
		return output;
	}
}
