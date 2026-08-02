// Напоминание туристам, которые начали сценарий в боте и не дошли до конца.
// Это сервисное сообщение по собственному запросу пользователя, а не реклама:
// отправляется один раз, только начавшим сценарий, и отключается командой /stop.

// Человекочитаемые названия шагов — их же показывает панель управления.
export const STEP_LABELS = {
	menu: 'Главное меню',
	pd: 'Согласие на обработку данных',
	travel: 'Памятка о правилах въезда',
	ads: 'Согласие на рекламные сообщения',
	_departureLead: 'Город вылета',
	_departureSub: 'Город вылета',
	destination: 'Направление',
	dates: 'Даты поездки',
	budget: 'Бюджет',
	group: 'Состав группы',
	wishes: 'Пожелания',
	_contacts: 'Имя и телефон',
	name: 'Имя',
	phone: 'Телефон',
	email: 'Email'
};

export const stepLabel = (step) => STEP_LABELS[step] || step || 'Не начат';

const FLOW_LABELS = { lead: 'Подбор тура', sub: 'Горящие туры' };
export const flowLabel = (flow) => FLOW_LABELS[flow] || flow || '—';

// Шаги, на которых человек ещё ничего не выбрал: напоминать не о чем.
const IDLE_STEPS = new Set(['', 'menu']);

export function funnelRows(users = [], now = Date.now()) {
	return users
		.filter((user) => user.funnel?.startedAt)
		.map((user) => {
			const funnel = user.funnel || {};
			const idleMs = now - new Date(funnel.updatedAt || funnel.startedAt).getTime();
			return {
				key: user.key,
				platform: user.platform,
				userId: user.userId,
				flow: funnel.flow || '',
				flowLabel: flowLabel(funnel.flow),
				step: funnel.step || '',
				stepLabel: funnel.completedAt ? funnel.step : stepLabel(funnel.step),
				startedAt: funnel.startedAt,
				updatedAt: funnel.updatedAt || funnel.startedAt,
				completedAt: funnel.completedAt || null,
				leadId: funnel.leadId || null,
				remindedAt: funnel.remindedAt || null,
				remindersOff: Boolean(funnel.remindersOff),
				idleMinutes: Math.max(0, Math.round(idleMs / 60000)),
				abandoned: !funnel.completedAt && !IDLE_STEPS.has(funnel.step || ''),
				destination: user.profile?.destination || '',
				steps: (user.trail || []).length,
				trail: user.trail || []
			};
		})
		.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export class BotFunnelReminder {
	constructor({ store, clients = {}, delayMinutes = 120, maxAgeHours = 72, quietFrom = 21, quietTo = 9, enabled = true, logger = console }) {
		Object.assign(this, { store, clients, delayMinutes, maxAgeHours, quietFrom, quietTo, enabled, logger });
	}

	start() {
		if (!this.enabled) return;
		this.timer = setInterval(() => this.tick().catch((error) => this.logger.error('Bot funnel reminder failed', { error: error.message })), 300000);
	}

	stop() {
		clearInterval(this.timer);
	}

	// Не будим людей ночью: окно по московскому времени.
	quiet(now) {
		const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }).format(now));
		return hour >= this.quietFrom || hour < this.quietTo;
	}

	due(row, now) {
		if (row.completedAt || row.remindedAt || row.remindersOff || !row.abandoned) return false;
		const idleMs = now - new Date(row.updatedAt).getTime();
		return idleMs >= this.delayMinutes * 60000 && idleMs <= this.maxAgeHours * 3600000;
	}

	message(row) {
		const where = row.flow === 'sub' ? 'подписку на горящие туры' : 'подбор тура';
		return {
			text: `Вы начали ${where} и остановились на шаге «${stepLabel(row.step)}». Ответы сохранены — продолжим?\n\nЕсли передумали, отправьте /stop, и мы больше не напомним.`,
			buttons: [[{ text: '▶️ Продолжить', callback: row.flow === 'sub' ? 'subscribe' : 'qualify' }], [{ text: '🏠 В меню', callback: 'menu' }]]
		};
	}

	async tick(now = new Date()) {
		if (!this.enabled || this.quiet(now)) return 0;
		const rows = funnelRows(this.store.listBotUsers?.() || [], now.getTime());
		let sent = 0;
		for (const row of rows) {
			if (!this.due(row, now.getTime())) continue;
			const client = this.clients[row.platform];
			if (!client?.send) continue;
			try {
				await client.send(row.userId, this.message(row));
				await this.store.markBotReminder?.(row.platform, row.userId);
				sent += 1;
			} catch (error) {
				this.logger.error('Bot funnel reminder delivery failed', { platform: row.platform, error: error.message });
			}
		}
		if (sent) this.logger.info?.('Bot funnel reminders sent', { sent });
		return sent;
	}
}
