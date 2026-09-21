// ============================================================
// sms.js — שליחת SMS מהאתר, דרך השרת המשותף (api.gofreeil.com)
//
// לאתר אין ספק SMS משלו, ולא צריך: ה-Strapi המשותף מחזיק את הספקים
// (SMSGate / Traccar / Twilio — community-backend/src/utils/sms.ts) ומגיש
// שני מסלולים שרת-לשרת, שנפתחים ל-API Token מסוג Full Access — אותו
// STRAPI_TOKEN שכבר משמש כאן לכל כתיבה:
//
//   GET  /api/admin/sms/status   האם מוגדר ספק, ואיזה
//   POST /api/admin/sms/send     { message, recipients: [{ phone, name }] }
//
// כשאף ספק לא מוגדר בשרת, smsStatus() מחזיר enabled=false והמסכים מציגים
// את הכפתורים כבויים עם הסבר — במקום להיכשל בלחיצה.
// ============================================================

import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';

// הסטטוס לא משתנה מרגע לרגע — מטמון כדי שלא ייווצר סבב בכל טעינת פאנל
const STATUS_TTL_MS = 5 * 60 * 1000;
/** @type {{at: number, value: {enabled: boolean, provider: string}} | null} */
let statusCache = null;

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/**
 * מספר ישראלי (מקומי או ‎972‎) → E.164. רק ניידים — SMS לא מגיע לקו נייח.
 * @param {string|null|undefined} phone
 * @returns {string|null} null = לא נראה כמו נייד ישראלי תקין
 */
export function toMobileE164(phone) {
	let d = String(phone ?? '').replace(/\D/g, '');
	if (d.startsWith('972')) d = '0' + d.slice(3);
	if (!/^05\d{8}$/.test(d)) return null;
	return '+972' + d.slice(1);
}

/**
 * האם השרת המשותף יודע לשלוח SMS עכשיו, ודרך מי. נכשל בשקט (enabled=false).
 * @param {boolean} [force]
 * @returns {Promise<{enabled: boolean, provider: string}>}
 */
export async function smsStatus(force = false) {
	if (!force && statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) {
		return statusCache.value;
	}
	/** @type {{enabled: boolean, provider: string}} */
	let value = { enabled: false, provider: 'none' };
	try {
		const res = await api('/api/admin/sms/status');
		if (res.ok) {
			const data = await res.json().catch(() => null);
			value = { enabled: data?.enabled === true, provider: String(data?.provider ?? 'none') };
		}
	} catch (e) {
		console.error('[sms] status failed:', e instanceof Error ? e.message : e);
	}
	statusCache = { at: Date.now(), value };
	return value;
}

/**
 * שולח SMS אחד. ההודעה נשלחת כמות שהיא (הסוגריים המסולסלים כבר הוחלפו
 * אצל הקורא). מחזיר תיאור כשל קריא לאדמין במקום לזרוק.
 * @param {{phone: string, name?: string, message: string}} input
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function sendSms({ phone, name = '', message }) {
	const e164 = toMobileE164(phone);
	if (!e164) return { ok: false, error: 'המספר אינו נייד ישראלי תקין' };
	const text = String(message ?? '').trim();
	if (!text) return { ok: false, error: 'ההודעה ריקה' };
	try {
		const res = await api('/api/admin/sms/send', {
			method: 'POST',
			body: JSON.stringify({ message: text, recipients: [{ phone: e164, name }] })
		});
		if (res.status === 503) return { ok: false, error: 'שליחת SMS אינה מוגדרת בשרת המשותף' };
		if (!res.ok) return { ok: false, error: `השרת המשותף החזיר ${res.status}` };
		const data = await res.json().catch(() => null);
		const r = Array.isArray(data?.results) ? data.results[0] : null;
		if (r && r.ok === false) {
			return {
				ok: false,
				error: r.error === 'invalid_phone' ? 'המספר אינו תקין' : String(r.error ?? 'כשל בשליחה')
			};
		}
		return { ok: true };
	} catch (e) {
		return {
			ok: false,
			error: 'השרת המשותף לא זמין: ' + (e instanceof Error ? e.message.slice(0, 120) : '')
		};
	}
}
