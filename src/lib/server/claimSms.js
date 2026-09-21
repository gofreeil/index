// ============================================================
// claimSms.js — הזמנה ב-SMS לבעל עסק לדרוש את הכרטיסייה שלו
//
// מסך הבעלות (admin/claims) מציג "התאמות שהמערכת מצאה": כרטיסייה בלי
// בעלים שהטלפון/האימייל שלה זהים לאלה של משתמש רשום. במקום לחכות שהוא
// יגלה את זה לבד, האדמין שולח לו SMS עם שני קישורים:
//
//   {link}     דף העסק עם ?claim=1 — תיבת "זה העסק שלי" נפתחת מיד, ואם
//              הוא לא מחובר, הכניסה מחזירה אותו לשם.
//   {decline}  "לא שלי" — קישור חתום (HMAC) שמסמן את ההתאמה כלא-נכונה
//              בלי להתחבר, כמו "התעלם" של האדמין. חתום כדי שאיש לא יוכל
//              לסגור התאמות של אחרים על ידי ניחוש מזהים.
//
// הנוסח נשמר ב-configStore (claim_sms_template) — אדמין עורך אותו במסך,
// ולפני כל שליחה עוד אפשר לערוך את ההודעה הספציפית. יומן השליחות
// (claim_sms_log) מציג על כל התאמה מתי ומי כבר שלח, כדי שלא ישלחו פעמיים
// בלי לשים לב.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getConfigValue, setConfigValueStrict } from './configStore.js';

const TEMPLATE_KEY = 'claim_sms_template';
const LOG_KEY = 'claim_sms_log';
const LOG_KEEP = 300;
// SMS בעברית הוא 70 תווים למקטע; שני קישורים כבר "אוכלים" מקטע. גג סביר
// לנוסח כולו כדי שההודעה לא תהפוך לחמישה מקטעים בטעות.
export const MAX_SMS_CHARS = 480;

export const DEFAULT_TEMPLATE =
	'שלום {name}, זיהינו שהכרטיסייה "{business}" במדריך בעלי המקצוע של יוצאים לחירות היא כנראה שלך. כדי לקבל עליה בעלות ולערוך אותה: {link}\nלא שלך? {decline}';

export const PLACEHOLDERS = [
	{ key: '{name}', help: 'שם המשתמש (או ריק)' },
	{ key: '{business}', help: 'שם הכרטיסייה' },
	{ key: '{link}', help: 'קישור לדף העסק עם תיבת הבקשה פתוחה' },
	{ key: '{decline}', help: 'קישור "לא שלי" שסוגר את ההתאמה' }
];

// ── נוסח ─────────────────────────────────────────────────────

/** הנוסח השמור, או ברירת המחדל. @returns {Promise<string>} */
export async function getClaimSmsTemplate() {
	const saved = await getConfigValue(TEMPLATE_KEY).catch(() => undefined);
	const text = typeof saved === 'string' ? saved.trim() : '';
	return text || DEFAULT_TEMPLATE;
}

/**
 * שומר נוסח חדש. ריק = חזרה לברירת המחדל. זורק בכישלון שמירה.
 * @param {string} text
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function setClaimSmsTemplate(text) {
	const t = String(text ?? '').trim();
	if (t.length > MAX_SMS_CHARS) {
		return { ok: false, error: `הנוסח ארוך מדי (עד ${MAX_SMS_CHARS} תווים)` };
	}
	if (t && !t.includes('{link}')) {
		return { ok: false, error: 'הנוסח חייב לכלול את {link} — בלעדיו אין לאן להיכנס' };
	}
	await setConfigValueStrict(TEMPLATE_KEY, t);
	return { ok: true };
}

/**
 * ממלא את הסוגריים. שם ריק נמחק יחד עם הרווח שלפניו ("שלום ," → "שלום,").
 * @param {string} template
 * @param {{name?: string, business?: string, link: string, decline: string}} v
 */
export function renderClaimSms(template, v) {
	const name = String(v.name ?? '').trim();
	let s = String(template ?? '');
	s = name ? s.replace(/\{name\}/g, name) : s.replace(/\s?\{name\}/g, '');
	s = s.replace(/\{business\}/g, String(v.business ?? '').trim());
	s = s.replace(/\{link\}/g, v.link).replace(/\{decline\}/g, v.decline);
	return s.trim();
}

// ── קישורים ──────────────────────────────────────────────────

/** המפתח לחתימה: STRAPI_TOKEN הוא סוד-שרת שכבר קיים בכל סביבה. */
function secret() {
	return env.CLAIM_LINK_SECRET || env.STRAPI_TOKEN || 'dev-only';
}

/** @param {string} bizDocId @param {string} userId */
function sign(bizDocId, userId) {
	return createHmac('sha256', secret())
		.update(`${bizDocId}|${userId}`)
		.digest('hex')
		.slice(0, 32);
}

/**
 * אסימון "לא שלי" — מזהה הכרטיסייה, המשתמש והחתימה. מזהי Strapi v5 הם
 * אלפאנומריים ומספריים, ולכן נקודה היא מפריד בטוח.
 * @param {string} bizDocId @param {string|number} userId
 */
export function declineToken(bizDocId, userId) {
	const uid = String(userId);
	return `${bizDocId}.${uid}.${sign(bizDocId, uid)}`;
}

/**
 * מאמת אסימון ומחזיר את המזהים, או null.
 * @param {string} token
 * @returns {{bizDocId: string, userId: string} | null}
 */
export function verifyDeclineToken(token) {
	const parts = String(token ?? '').split('.');
	if (parts.length !== 3) return null;
	const [bizDocId, userId, sig] = parts;
	if (!/^[A-Za-z0-9_-]+$/.test(bizDocId) || !/^\d+$/.test(userId) || !/^[0-9a-f]{32}$/.test(sig)) {
		return null;
	}
	const expected = sign(bizDocId, userId);
	if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
	return { bizDocId, userId };
}

/**
 * שני הקישורים שנכנסים להודעה. origin = של הבקשה הנוכחית, כדי שבפריוויו
 * של Vercel הקישור יוביל לאותה סביבה.
 * @param {string} origin @param {string} bizDocId @param {string|number} userId
 */
export function claimLinks(origin, bizDocId, userId) {
	const base = origin.replace(/\/$/, '');
	return {
		link: `${base}/business/${encodeURIComponent(bizDocId)}?claim=1#claim`,
		decline: `${base}/claim/decline/${declineToken(bizDocId, userId)}`
	};
}

// ── יומן שליחות ──────────────────────────────────────────────

/**
 * @typedef {{at: string, by: string, phone: string}} SmsLogEntry
 */

/** @param {string} bizDocId @param {string|number} userId */
export const smsLogKey = (bizDocId, userId) => `${bizDocId}|${userId}`;

/** @returns {Promise<Record<string, SmsLogEntry>>} */
export async function getClaimSmsLog() {
	const raw = await getConfigValue(LOG_KEY).catch(() => undefined);
	return raw && typeof raw === 'object'
		? /** @type {Record<string, SmsLogEntry>} */ (raw)
		: {};
}

/**
 * רושם שליחה. נכשל בשקט — ה-SMS כבר יצא, והיומן הוא נוחות בלבד.
 * @param {{bizDocId: string, userId: string|number, by: string, phone: string}} e
 */
export async function recordClaimSms({ bizDocId, userId, by, phone }) {
	try {
		const log = { ...(await getClaimSmsLog()) };
		log[smsLogKey(bizDocId, userId)] = { at: new Date().toISOString(), by, phone };
		const keys = Object.keys(log);
		if (keys.length > LOG_KEEP) {
			keys
				.sort((a, b) => String(log[a].at).localeCompare(String(log[b].at)))
				.slice(0, keys.length - LOG_KEEP)
				.forEach((k) => delete log[k]);
		}
		await setConfigValueStrict(LOG_KEY, log);
	} catch (e) {
		console.error('[claim-sms] log failed:', e instanceof Error ? e.message : e);
	}
}
