#!/usr/bin/env node
// \u041f\u0430\u0440\u0441\u0435\u0440 \u043f\u0440\u0430\u0432\u0438\u043b \u0432\u044a\u0435\u0437\u0434\u0430 \u0441 r-express.ru -> web/data/visa-rules.json
// \u0417\u0430\u043f\u0443\u0441\u043a: node scripts/fetch-visa-rules.mjs [--only=turkey,egypt] [--force]
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const OUT = join(process.cwd(), 'web', 'data', 'visa-rules.json')
const BASE = 'https://r-express.ru/guide/'
const PATHS = ['rules/', 'rules/pravila-vezda-dla-grazdan-rf/', 'memo/']
const UA = 'Mozilla/5.0 (compatible; SbezhimNaMoreBot/1.0; +https://tursbezhimnamore.ru)'

// id \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u043d\u0430 \u0441\u0430\u0439\u0442\u0435 -> \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b slug \u043d\u0430 r-express.ru
const SLUGS = {
  abhaziya: ['abhaziya'], turkey: ['turkey'], egypt: ['egypt'], uae: ['uae'],
  thailand: ['tai'], maldives: ['maldives'], vietnam: ['vietnam'], seychelles: ['seychelles'],
  china: ['china'], oman: ['oman'], qatar: ['qatar'], cuba: ['cuba'], india: ['india'],
  srilanka: ['srilanka'], armenia: ['armenia'], azerbaijan: ['azerbaijan'], belarus: ['belarus'],
  kazakhstan: ['kazahstan', 'kazakhstan'], kyrgyzstan: ['kyrgyzstan', 'kirgiziya'],
  uzbekistan: ['uzbekistan'], tajikistan: ['tadzhikistan', 'tajikistan'],
  georgia: ['georgia'], moldova: ['moldova', 'moldaviya'], serbia: ['serbia'],
  montenegro: ['montenegro'], bosnia: ['bosnia', 'bosniya', 'bosnia-i-gercegovina'],
  macedonia: ['macedonia', 'makedoniya', 'severnaa-makedonia'], albania: ['albania'],
  cyprus: ['cyprus'], uk: ['great-britain', 'velikobritaniya', 'uk', 'england'],
  malaysia: ['malaysia'], indonesia: ['indonesia'], philippines: ['filippiny', 'philippines'],
  singapore: ['singapore'], cambodia: ['kambodzha', 'cambodia'], laos: ['laos'],
  myanmar: ['myanmar', 'mianma'], nepal: ['nepal'], mongolia: ['mongolia', 'mongoliya'],
  hongkong: ['hongkong', 'gonkong'], macao: ['macao', 'makao'],
  southkorea: ['republic-korea', 'korea'], japan: ['japan'], taiwan: ['tayvan'],
  israel: ['israel', 'izrail'], jordan: ['jordan'], bahrain: ['bahrain'], saudi: ['saudi'],
  kuwait: ['kuwait', 'kuveyt'], iran: ['iran'], tunisia: ['tunisia'], morocco: ['morocco'],
  southafrica: ['rsa', 'south-africa'], kenya: ['kenya'], tanzania: ['tanzania'],
  mauritius: ['mauritius'], mexico: ['mexico'], dominicana: ['dominican', 'dominicana'],
  jamaica: ['jamaica', 'yamayka'], brazil: ['brazilia', 'brazil'], argentina: ['argentina'],
  chile: ['chile', 'chili'], peru: ['peru'], costarica: ['costa-rica', 'kostarika'],
  usa: ['usa', 'ssha'], canada: ['canada'], australia: ['australia', 'avstraliya'],
  newzealand: ['new-zealand', 'novaa-zelandia'], italy: ['italy'], russia: ['russia'],
}

const PASSPORT = /^(\u0417\u0430\u0433\u0440\u0430\u043d\u043f\u0430\u0441\u043f\u043e\u0440\u0442|\u0417\u0430\u0433\u0440\u0430\u043d\u0438\u0447\u043d\u044b\u0439 \u043f\u0430\u0441\u043f\u043e\u0440\u0442|\u041f\u0430\u0441\u043f\u043e\u0440\u0442|\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044e\u0449\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b)/i
const KIDS = /(\u0412\u044a\u0435\u0437\u0434 \u043d\u0435\u0441\u043e\u0432\u0435\u0440\u0448\u0435\u043d\u043d\u043e\u043b\u0435\u0442\u043d|\u0421\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u0432\u0442\u043e\u0440\u043e\u0433\u043e \u0440\u043e\u0434\u0438\u0442\u0435\u043b|\u0412\u044b\u0435\u0437\u0434 \u0438\u0437 \u0420\u043e\u0441\u0441\u0438\u0439\u0441\u043a\u043e\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u043d\u0435\u0441\u043e\u0432\u0435\u0440\u0448\u0435\u043d\u043d\u043e\u043b\u0435\u0442\u043d|\u0414\u0435\u0442\u0438 \u0434\u043e 18)/i
const HEADS = [
  ['passport', PASSPORT],
  ['insurance', /^\u0421\u0442\u0440\u0430\u0445\u043e\u0432\u043e\u0439 \u043f\u043e\u043b\u0438\u0441/i],
  ['currency', /^\u0412\u0430\u043b\u044e\u0442\u0430/i],
  ['visaRules', /^\u0412\u0438\u0437\u0430/i],
  ['children', KIDS],
]
const PLAIN_TITLES = ['\u0417\u0430\u0433\u0440\u0430\u043d\u043f\u0430\u0441\u043f\u043e\u0440\u0442', '\u0417\u0430\u0433\u0440\u0430\u043d\u0438\u0447\u043d\u044b\u0439 \u043f\u0430\u0441\u043f\u043e\u0440\u0442', '\u041f\u0430\u0441\u043f\u043e\u0440\u0442', '\u0421\u0442\u0440\u0430\u0445\u043e\u0432\u043e\u0439 \u043f\u043e\u043b\u0438\u0441', '\u0412\u0430\u043b\u044e\u0442\u0430', '\u0412\u0438\u0437\u0430']
const PLAIN = new RegExp(`^(${PLAIN_TITLES.join('|')})\\s*:?\\s*$`, 'i')

const clean = (s) => s
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|li|div|h[1-6]|tr|strong|b)>/gi, '\n')
  .replace(/<li[^>]*>/gi, '\u2022 ')
  .replace(/<(strong|b)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&laquo;/g, '\u00ab').replace(/&raquo;/g, '\u00bb')
  .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&quot;/g, '"').replace(/&#\d+;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t\u00a0]+/g, ' ')
  .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')

const NOISE = /(\u041f\u043e\u043c\u043e\u0436\u0435\u043c \u0441 \u043f\u043e\u0438\u0441\u043a\u043e\u043c|\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0437\u0430\u044f\u0432\u043a\u0443|\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0435 \u0442\u0443\u0440\u044b|\u041f\u043e\u0434\u043f\u0438\u0448\u0438\u0442\u0435\u0441\u044c \u043d\u0430 \u0440\u0430\u0441\u0441\u044b\u043b\u043a\u0443|\u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445|\u0414\u0440\u0443\u0433\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u044b|\u041d\u043e\u0432\u043e\u0441\u0442\u0438 \u043f\u043e \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f\u043c)/i
const lines = (text) => text.split('\n')
  .map((l) => l.replace(/^\u2022\s*/, '').replace(/^\d{1,2}\.\s*/, '').trim())
  .filter((l) => l.length > 25 && !NOISE.test(l))
  .slice(0, 12)

const headIndex = (all) => {
  const marks = []
  all.forEach((line, i) => {
    const numbered = line.match(/^\d{1,2}\.\s*(.{3,60})$/)
    if (numbered && (PASSPORT.test(numbered[1]) || /^(\u0421\u0442\u0440\u0430\u0445\u043e\u0432\u043e\u0439 \u043f\u043e\u043b\u0438\u0441|\u0412\u0430\u043b\u044e\u0442\u0430|\u0412\u0438\u0437\u0430)/i.test(numbered[1]) || KIDS.test(numbered[1]))) {
      marks.push({ i, title: numbered[1].trim() })
      return
    }
    if (PLAIN.test(line)) { marks.push({ i, title: line.replace(/:$/, '').trim() }); return }
    if (KIDS.test(line) && line.length < 140) marks.push({ i, title: line })
  })
  return marks.filter((mark, k) => k === 0 || mark.i !== marks[k - 1].i)
}

const parse = (html, url) => {
  const all = clean(html).split('\n')
  const marks = headIndex(all)
  if (!marks.length) return null
  const out = { source: url }
  marks.forEach((mark, k) => {
    const stop = k + 1 < marks.length ? marks[k + 1].i : Math.min(all.length, mark.i + 30)
    const body = lines(all.slice(mark.i + 1, stop).join('\n'))
    if (!body.length) return
    const hit = HEADS.find(([, re]) => re.test(mark.title))
    if (!hit) return
    const key = hit[0]
    if (key === 'children') out.children = (out.children || []).concat(body).slice(0, 14)
    else if (!out[key]) out[key] = body.length === 1 ? body[0] : body
  })
  const alert = all.find((l) => /^\u0412\u043d\u0438\u043c\u0430\u043d\u0438\u0435!/.test(l) && l.length > 60 && !/10 000 USD/.test(l) && !NOISE.test(l))
  if (alert) out.alert = alert
  const keys = Object.keys(out).filter((k) => k !== 'source')
  return keys.length >= 2 ? out : null
}

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } })
  if (!res.ok) return null
  return res.text()
}

const main = async () => {
  const args = process.argv.slice(2)
  const only = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean)
  const force = args.includes('--force')
  let current = {}
  try { current = JSON.parse(await readFile(OUT, 'utf8')) } catch { current = {} }
  const ids = Object.keys(SLUGS).filter((id) => !only.length || only.includes(id))
  let ok = 0, skip = 0, fail = 0
  for (const id of ids) {
    if (!force && current[id]) { skip++; continue }
    let data = null
    outer: for (const slug of SLUGS[id]) {
      for (const path of PATHS) {
        const url = `${BASE}${slug}/${path}`
        try {
          const html = await get(url)
          if (!html) continue
          data = parse(html, url)
          if (data) break outer
        } catch (error) {
          console.error(`! ${id} ${slug}: ${error.message}`)
        }
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    if (data) { current[id] = data; ok++; console.log(`+ ${id} <- ${data.source}`) }
    else { fail++; console.log(`- ${id}: \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e`) }
    await new Promise((r) => setTimeout(r, 500))
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(current, null, 1)}\n`, 'utf8')
  console.log(`\n\u0413\u043e\u0442\u043e\u0432\u043e: \u043d\u043e\u0432\u044b\u0445 ${ok}, \u0431\u044b\u043b\u043e ${skip}, \u0431\u0435\u0437 \u0434\u0430\u043d\u043d\u044b\u0445 ${fail}. \u0424\u0430\u0439\u043b: ${OUT}`)
}

main().catch((error) => { console.error(error); process.exit(1) })
