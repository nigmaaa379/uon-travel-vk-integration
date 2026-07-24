import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const LEGAL_DOCUMENTS = {
  privacy: 'Политика конфиденциальности',
  consent: 'Согласие на обработку персональных данных',
  'marketing-consent': 'Согласие на рекламные сообщения',
  cookies: 'Политика использования cookie',
  offer: 'Условия оказания турагентских услуг',
  payment: 'Условия оплаты',
  booking: 'Правила бронирования',
  refund: 'Возврат денежных средств',
  'tour-contract': 'Шаблон договора о реализации туристского продукта'
};

const CHANNELS_HTML = '<h2>Официальные каналы связи и подачи заявок</h2><ul><li><a href="https://vk.com/turagentgorevalubov">ВКонтакте — «Сбежим на море»</a></li><li><a href="https://t.me/tur_sbezhimnamore">Telegram — @tur_sbezhimnamore</a></li><li><a href="https://max.ru/channel_id761700450685_biz">MAX — «Сбежим на море»</a></li></ul><p>Обращения, направленные через указанные официальные каналы, могут обрабатываться в CRM U-ON Travel для ответа, подбора туристского продукта и дальнейшего сопровождения.</p>';
const ALLOWED_TAGS = new Set(['h2','h3','p','ul','ol','li','strong','b','em','i','a','br']);
const safeLink = (href) => href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^https:\/\/(?:www\.)?(?:tursbezhimnamore\.ru|consultant\.ru|vk\.com)(?:\/|$)/i.test(href) || /^https:\/\/(?:publication\.pravo\.gov\.ru|t\.me|max\.ru)(?:\/|$)/i.test(href);
const escapeAttr = (value) => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const escapeText = (value) => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const stripTags = (value) => value.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();

export function sanitizeLegalHtml(input) {
  const source = String(input || '').replace(/<!--[\s\S]*?-->/g,'').trim();
  if (!source || source.length > 100000) throw new Error('Текст документа пустой или слишком большой.');
  if (/<\s*(script|style|iframe|object|embed|form|input|button|img|svg|link|meta)\b/i.test(source) || /on[a-z]+\s*=|javascript:|data:/i.test(source)) throw new Error('Документ содержит небезопасный HTML.');
  return source.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawTag, attrs) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) throw new Error(`Недопустимый HTML-тег: ${tag}`);
    if (full.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br>';
    if (tag === 'a') {
      const match = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!match || !safeLink(match[1])) throw new Error('В документе обнаружена недопустимая ссылка.');
      return `<a href="${escapeAttr(match[1])}">`;
    }
    return `<${tag}>`;
  });
}

function formatDateRu(value) { const date = new Date(`${value}T00:00:00Z`); if (Number.isNaN(date.getTime())) return value; const formatted = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date).replace(/\s*г\.$/,''); return formatted + ' года'; }
function enrichChannels(document) { return { ...document, contentHtml: String(document.contentHtml || '').replace(/идентификатор пользователя VK/g,'идентификатор пользователя во ВКонтакте, Telegram или MAX').replace(/при обращении через VK/g,'при обращении через ВКонтакте, Telegram или MAX').replace(/<b>VK<\/b> — получение сообщений пользователя и отправка служебных сообщений;/g,'<b>ВКонтакте, Telegram и MAX</b> — получение обращений пользователя и отправка служебных сообщений;').replace(/U-ON Travel, VK, Mail\.ru/g,'U-ON Travel, ВКонтакте, Telegram, MAX и Mail.ru') }; }
function extractDefault(html, slug) { const article = html.match(/<article class="legal-content">([\s\S]*?)<\/article>/i)?.[1] || ''; const titleMatch = article.match(/<h1>([\s\S]*?)<\/h1>/i) || html.match(/<title>([^—<]+)/i); const body = article.replace(/<a class="legal-back"[\s\S]*?<\/a>/i,'').replace(/<h1>[\s\S]*?<\/h1>/i,'').replace(/<p><b>Редакция от[\s\S]*?<\/p>/i,'').trim(); return enrichChannels({ slug, label: LEGAL_DOCUMENTS[slug], title: stripTags(titleMatch?.[1] || LEGAL_DOCUMENTS[slug]), version: '2026-07-24', contentHtml: sanitizeLegalHtml(body), updatedAt: null, history: [] }); }
export async function getLegalDocument({ slug, store, siteRoot }) { if (!LEGAL_DOCUMENTS[slug]) return null; const saved = store.getLegalDocument?.(slug); if (saved) return enrichChannels({ slug, label: LEGAL_DOCUMENTS[slug], ...saved }); const html = await readFile(join(siteRoot,'legal',`${slug}.html`),'utf8'); return extractDefault(html,slug); }
export async function listLegalDocuments({ store, siteRoot }) { return Promise.all(Object.keys(LEGAL_DOCUMENTS).map((slug)=>getLegalDocument({slug,store,siteRoot}))); }
export function validateLegalDocument(body) { const slug = String(body?.slug || ''); if (!LEGAL_DOCUMENTS[slug]) throw new Error('Неизвестный юридический документ.'); const title = String(body?.title || '').trim(); const version = String(body?.version || '').trim(); if (/[<>]/.test(title) || title.length < 5 || title.length > 180) throw new Error('Заголовок должен содержать от 5 до 180 символов без HTML.'); if (!/^\d{4}-\d{2}-\d{2}$/.test(version) || Number.isNaN(Date.parse(`${version}T00:00:00Z`))) throw new Error('Версия должна быть корректной датой в формате ГГГГ-ММ-ДД.'); return { slug, title, version, contentHtml: sanitizeLegalHtml(body.contentHtml) }; }
export function renderLegalDocument(document) { const canonical = document.slug === 'privacy' ? 'https://tursbezhimnamore.ru/page/privacy' : 'https://tursbezhimnamore.ru/legal/' + document.slug + '.html'; return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(document.title)} — Сбежим на море</title><meta name="description" content="${escapeAttr(document.label)} турагентства Сбежим на море."><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/assets/styles.css"></head><body class="legal-page"><header class="legal-header"><div class="wrap"><a class="brand" href="/"><b>Сбежим на море</b><span>Турагентство онлайн</span></a></div></header><main class="wrap"><article class="legal-content"><a class="legal-back" href="/">← Вернуться на сайт</a><h1>${escapeText(document.title)}</h1><p><b>Редакция от ${formatDateRu(document.version)}</b></p>${document.contentHtml}${CHANNELS_HTML}</article></main></body></html>`; }
