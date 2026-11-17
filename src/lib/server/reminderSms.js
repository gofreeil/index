// ============================================================
// reminderSms.js — SMS בוקר לבעל העסק על התזכורות של היום ב"למי שלחתי".
//
// נקרא פעם ביום מ-Vercel Cron (api/cron/reminders, ראו vercel.json — בתוכנית
// הנוכחית Vercel מריץ cron לכל היותר פעם ביום, ולכן זה סיכום בוקר ולא SMS
// בדקה המדויקת; להתראה בדקה — כפתור היומן בתזכורת).
//
// עובר על כל יומני השליחות (קטגוריה __idx_shares), אוסף לכל משתמש את
// התזכורות שנופלות היום (שעון ישראל), ושולח SMS אחד לטלפון שבפרופיל שלו
// דרך השרת המשותף (sms.js). תזכורת אחת → קישור וואטסאפ ישיר לנמען;
// כמה → קישור לטבלה באזור האישי.
//
// מניעת כפילות: היום האחרון שנשלח נשמר ב-configStore (reminder_sms_day) —
// הרצה חוזרת של ה-cron באותו יום לא שולחת שוב.
// ============================================================

import { env } from '$env/dynamic/private';
import { normalizeShareLog, cleanRemoved } from '$lib/shareLogMerge.js';
import { getUserPhone } from './strapi.js';
import { sendSms, smsStatus } from './sms.js';
import { getConfigValue, setConfigValue } from './configStore.js';
import { SITE_URL } from '$lib/seo';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const TZ = 'Asia/Jerusalem';
const DAY_KEY = 'reminder_sms_day';

/** תאריך ושעה בשעון ישראל. @param {number} ts */
function ilParts(ts) {
	const f = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(ts));
	/** @param {string} t */
	const g = (t) => f.find((p) => p.type === t)?.value ?? '';
	return { day: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
}

/** כל יומני השליחות, עמוד אחר עמוד. */
async function allShareLogs() {
	const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : undefined;
	/** @type {any[]} */
	const out = [];
	for (let page = 1; page <= 50; page++) {
		const qs =
			`filters[category][$eq]=__idx_shares&fields[0]=label&fields[1]=extra_fields` +
			`&pagination[page]=${page}&pagination[pageSize]=100`;
		const res = await fetch(`${STRAPI_URL}/api/items?${qs}`, { headers });
		if (!res.ok) throw new Error(`share logs → ${res.status}`);
		const data = await res.json().catch(() => null);
		const items = Array.isArray(data?.data) ? data.data : [];
		out.push(...items);
		if (page >= (data?.meta?.pagination?.pageCount ?? 1)) break;
	}
	return out;
}

/**
 * @param {{ force?: boolean, now?: number }} [opts]
 * @returns {Promise<{ day: string, skipped?: string, users: number, sent: number, failed: number }>}
 */
export async function sendTodayReminderSms({ force = false, now = Date.now() } = {}) {
	const today = ilParts(now).day;
	if (!force && (await getConfigValue(DAY_KEY).catch(() => '')) === today) {
		return { day: today, skipped: 'already sent today', users: 0, sent: 0, failed: 0 };
	}
	const status = await smsStatus(true);
	if (!status.enabled) return { day: today, skipped: 'sms not configured', users: 0, sent: 0, failed: 0 };

	let users = 0;
	let sent = 0;
	let failed = 0;
	for (const item of await allShareLogs()) {
		const userId = String(item?.label ?? '').replace(/^idx-shares:/, '');
		const extra = item?.extra_fields ?? {};
		const entries = normalizeShareLog(extra.entries, {
			clearedAt: Number(extra.clearedAt) || 0,
			removed: cleanRemoved(extra.removed)
		})
			.filter((e) => e.remindAt && ilParts(e.remindAt).day === today)
			.sort((a, b) => a.remindAt - b.remindAt);
		if (!userId || !entries.length) continue;
		users++;

		const phone = await getUserPhone(userId);
		if (!phone) continue;

		let message;
		if (entries.length === 1) {
			const e = entries[0];
			message =
				`🔔 תזכורת: היום ב-${ilParts(e.remindAt).time} לחזור ל${e.name || e.pretty}` +
				`${e.bizName ? ` (${e.bizName})` : ''}.\nוואטסאפ: https://wa.me/${e.wa}`;
		} else {
			const names = entries
				.slice(0, 4)
				.map((e) => `${ilParts(e.remindAt).time} ${e.name || e.pretty}`)
				.join('\n');
			const more = entries.length > 4 ? `\nועוד ${entries.length - 4}` : '';
			message = `🔔 ${entries.length} תזכורות להיום:\n${names}${more}\nלרשימה: ${SITE_URL}/profile#sent`;
		}
		const r = await sendSms({ phone, message });
		if (r.ok) sent++;
		else {
			failed++;
			console.error(`[reminder-sms] user ${userId}:`, r.error);
		}
	}
	await setConfigValue(DAY_KEY, today).catch(() => {});
	return { day: today, users, sent, failed };
}
