// ============================================================
// claimSms.js — הזמנה ב-SMS לבעל עסק לדרוש את הכרטיסייה שלו
//
// מסך הבעלות (admin/claims) מציג "התאמות שהמערכת מצאה": כרטיסייה בלי
// בעלים שהטלפון/האימייל שלה זהים לאלה של משתמש רשום. במקום לחכות שהוא
// יגלה את זה לבד, האדמין שולח לו SMS עם שני קישורים:
//
//   {link}     /c/<id>.<userId>.<sig> — מפנה לדף העסק עם ?claim=1, כלומר
//              תיבת "זה העסק שלי" נפתחת מיד, ואם הוא לא מחובר הכניסה מחזירה
//              אותו לשם. הקישור חתום ושייך למשתמש שהמערכת זיהתה: כשהוא עצמו
//              מחובר ולוחץ, הבעלות עוברת מיד — בלי אישור אדמין (ראו
//              claimInviteUser). קישורים ישנים (/c/<id>) רק פותחים את התיבה.
//   {decline}  /d/<token> — "לא שלי": קישור חתום (HMAC) שמסמן את ההתאמה
//              כלא-נכונה בלי להתחבר, כמו "התעלם" של האדמין. חתום כדי
//              שאיש לא יוכל לסגור התאמות של אחרים על ידי ניחוש מזהים.
//
// שתי הכתובות קצרות בכוונה: ב-SMS עברי מקטע הוא 70 תווים, וכתובת מלאה
// של /business/<id>?claim=1#claim אכלה מקטע שלם לבדה.
//
// הנוסח נשמר ב-configStore (claim_sms_template) — אדמין עורך אותו במסך,
// ולפני כל שליחה עוד אפשר לערוך את ההודעה הספציפית. יומן השליחות
// (claim_sms_log) מציג על כל התאמה מתי ומי כבר שלח, כדי שלא ישלחו פעמיים
// בלי לשים לב.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
/** @typedef {import('@sveltejs/kit').Cookies} Cookies */
import { getConfigValue, setConfigValueStrict } from './configStore.js';

const TEMPLATE_KEY = 'claim_sms_template';
const LOG_KEY = 'claim_sms_log';
const LOG_KEEP = 300;
// SMS בעברית הוא 70 תווים למקטע; שני קישורים כבר "אוכלים" מקטע. גג סביר
// לנוסח כולו כדי שההודעה לא תהפוך לחמישה מקטעים בטעות.
export const MAX_SMS_CHARS = 480;

// כל קישור עומד בשורה משלו אחרי המלל שמסביר אותו: ב-SMS אין טקסט-עוגן,
// ושתי כתובות בתוך משפט הופכות את ההודעה לקיר תווים שקשה לקרוא.
export const DEFAULT_TEMPLATE =
	'שלום {name}, זיהינו שהכרטיסייה "{business}" במדריך בעלי המקצוע של יוצאים לחירות היא כנראה שלך.\n' +
	'כנס כדי לבדוק ולקבל עליה בעלות:\n{link}\n' +
	'או דחה — אני כבר לא מעוניין שהעסק שלי יופיע בקהילה:\n{decline}';

export const PLACEHOLDERS = [
	{ key: '{name}', help: 'שם המשתמש (או ריק)' },
	{ key: '{business}', help: 'שם הכרטיסייה' },
	{ key: '{link}', help: 'קישור קצר לדף העסק עם תיבת הבקשה פתוחה' },
	{ key: '{decline}', help: 'קישור קצר "לא שלי" שסוגר את ההתאמה' }
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

// אורך החתימה בקישור. 12 תווי hex = 48 סיביות — די והותר מול ניחוש של
// פעולה שכל כולה "סמן שההתאמה הזו לא נכונה", ו-20 תווים פחות בהודעה.
const SIG_LEN = 12;

/** @param {string} bizDocId @param {string} userId */
function sign(bizDocId, userId) {
	return createHmac('sha256', secret()).update(`${bizDocId}|${userId}`).digest('hex').slice(0, 32);
}

/**
 * אסימון "לא שלי" — מזהה הכרטיסייה, המשתמש והחתימה. מזהי Strapi v5 הם
 * אלפאנומריים ומספריים, ולכן נקודה היא מפריד בטוח.
 * @param {string} bizDocId @param {string|number} userId
 */
export function declineToken(bizDocId, userId) {
	const uid = String(userId);
	return `${bizDocId}.${uid}.${sign(bizDocId, uid).slice(0, SIG_LEN)}`;
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
	// גם חתימה באורך 32 — כך שקישורים שכבר יצאו ב-SMS לפני הקיצור עדיין עובדים.
	if (
		!/^[A-Za-z0-9_-]+$/.test(bizDocId) ||
		!/^\d+$/.test(userId) ||
		!new RegExp(`^[0-9a-f]{${SIG_LEN}}([0-9a-f]{${32 - SIG_LEN}})?$`).test(sig)
	) {
		return null;
	}
	const expected = sign(bizDocId, userId).slice(0, sig.length);
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
		link: `${base}/c/${bizDocId}.${String(userId)}.${signFor('link', bizDocId, String(userId))}`,
		decline: `${base}/d/${declineToken(bizDocId, userId)}`
	};
}

// ── קישור חתום → בעלות מיידית ────────────────────────────────

const INVITE_COOKIE = 'ix_claim_invite';

/**
 * חתימה נפרדת לכל שימוש — אסימון "לא שלי" לא ישמש כקישור בעלות
 * @param {string} purpose @param {string} bizDocId @param {string} userId */
function signFor(purpose, bizDocId, userId) {
	return createHmac('sha256', secret()).update(`${purpose}|${bizDocId}|${userId}`).digest('hex').slice(0, SIG_LEN);
}

/** @param {string} a @param {string} b */
const sameSig = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * מפרק את /c/<param>: חתום (<biz>.<userId>.<sig>) או ישן (<biz> בלבד).
 * @param {string} param
 * @returns {{bizDocId: string, userId: string} | null} userId ריק = קישור ישן
 */
export function parseClaimLink(param) {
	const parts = String(param ?? '').split('.');
	if (!/^[A-Za-z0-9_-]+$/.test(parts[0] ?? '')) return null;
	if (parts.length === 1) return { bizDocId: parts[0], userId: '' };
	if (parts.length !== 3 || !/^d+$/.test(parts[1]) || !/^[0-9a-f]+$/.test(parts[2])) return null;
	const [bizDocId, userId, sig] = parts;
	return sameSig(sig, signFor('link', bizDocId, userId)) ? { bizDocId, userId } : null;
}

/**
 * זוכר בדפדפן שנכנס מהקישור החתום — עד שיתחבר ויחזור לדף העסק
 * @param {Cookies} cookies @param {string} bizDocId @param {string} userId */
export function setClaimInviteCookie(cookies, bizDocId, userId) {
	cookies.set(INVITE_COOKIE, `${bizDocId}.${userId}.${signFor('cookie', bizDocId, userId)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 30 * 24 * 3600
	});
}

/**
 * המשתמש שהקישור החתום נשלח אליו עבור הכרטיסייה הזו, או ''.
 * @param {Cookies} cookies @param {string} bizDocId
 */
export function claimInviteUser(cookies, bizDocId) {
	const [biz, uid, sig] = String(cookies.get(INVITE_COOKIE) ?? '').split('.');
	if (!biz || biz !== bizDocId || !uid || !sig) return '';
	return sameSig(sig, signFor('cookie', biz, uid)) ? uid : '';
}

// ── יומן שליחות ──────────────────────────────────────────────

/**
 * @typedef {{at: string, by: string, phone: string, bizName?: string, userName?: string,
 *   openedAt?: string, opens?: number, requestedAt?: string, claimedAt?: string, declinedAt?: string}} SmsLogEntry
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
 * שליחה חוזרת שומרת את המעקב (כניסות/דחייה/בעלות) של אותה התאמה.
 * @param {{bizDocId: string, userId: string|number, by: string, phone: string, bizName?: string, userName?: string}} e
 */
export async function recordClaimSms({ bizDocId, userId, by, phone, bizName, userName }) {
	try {
		const log = { ...(await getClaimSmsLog()) };
		const key = smsLogKey(bizDocId, userId);
		log[key] = {
			...log[key],
			at: new Date().toISOString(),
			by,
			phone,
			...(bizName ? { bizName } : {}),
			...(userName ? { userName } : {})
		};
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

/**
 * מעקב תגובות: כניסה מהקישור / בקשת בעלות / קבלת בעלות / "לא שלי".
 * נכשל בשקט — לא חוסם את המשתמש.
 * @param {string} bizDocId @param {string|number} userId
 * @param {'open'|'request'|'claimed'|'declined'} kind
 */
export async function recordClaimEvent(bizDocId, userId, kind) {
	try {
		const log = { ...(await getClaimSmsLog()) };
		const key = smsLogKey(bizDocId, userId);
		const c = log[key];
		if (!c) return; // רק התאמות שנשלח להן SMS
		const now = new Date().toISOString();
		log[key] =
			kind === 'open'
				? { ...c, openedAt: c.openedAt ?? now, opens: (c.opens ?? 0) + 1 }
				: kind === 'request'
					? { ...c, requestedAt: c.requestedAt ?? now }
					: kind === 'claimed'
						? { ...c, claimedAt: c.claimedAt ?? now }
						: { ...c, declinedAt: c.declinedAt ?? now };
		await setConfigValueStrict(LOG_KEY, log);
	} catch (e) {
		console.error('[claim-sms] track failed:', e instanceof Error ? e.message : e);
	}
}

// ── הודעת אישור בעלות ────────────────────────────────────────
//
// אחרי שאדמין שייך כרטיסייה, הוא שולח לבעל העסק הודעה שהיא שלו + קישור
// קצר (/e/<id>) לעריכה — בלעדיה בעל העסק לא יודע שהבקשה אושרה. הנוסח
// נשמר בנפרד מנוסח ההזמנה (claim_owner_sms_template), ולפני כל שליחה
// עוד אפשר לערוך את ההודעה הספציפית.

const OWNER_TEMPLATE_KEY = 'claim_owner_sms_template';

export const DEFAULT_OWNER_TEMPLATE =
	'שלום {name}, הכרטיסייה "{business}" במדריך בעלי המקצוע של יוצאים לחירות שויכה אליך.\n' +
	'לניהול ועריכת העסק שלך:\n{link}';

export const OWNER_PLACEHOLDERS = [
	{ key: '{name}', help: 'שם המשתמש (או ריק)' },
	{ key: '{business}', help: 'שם הכרטיסייה' },
	{ key: '{link}', help: 'קישור קצר לעריכת העסק' }
];

/** @returns {Promise<string>} */
export async function getOwnerSmsTemplate() {
	const saved = await getConfigValue(OWNER_TEMPLATE_KEY).catch(() => undefined);
	const text = typeof saved === 'string' ? saved.trim() : '';
	return text || DEFAULT_OWNER_TEMPLATE;
}

/**
 * ריק = חזרה לברירת המחדל. זורק בכישלון שמירה.
 * @param {string} text
 * @returns {Promise<{ok: true} | {ok: false, error: string}>}
 */
export async function setOwnerSmsTemplate(text) {
	const t = String(text ?? '').trim();
	if (t.length > MAX_SMS_CHARS) {
		return { ok: false, error: `הנוסח ארוך מדי (עד ${MAX_SMS_CHARS} תווים)` };
	}
	if (t && !t.includes('{link}')) {
		return { ok: false, error: 'הנוסח חייב לכלול את {link} — בלעדיו אין לאן להיכנס' };
	}
	await setConfigValueStrict(OWNER_TEMPLATE_KEY, t);
	return { ok: true };
}

/**
 * @param {string} template @param {string} origin
 * @param {{bizDocId: string, bizName?: string, userName?: string}} v
 */
export function renderOwnerSms(template, origin, { bizDocId, bizName, userName }) {
	const link = `${origin.replace(/\/$/, '')}/e/${encodeURIComponent(bizDocId)}`;
	return renderClaimSms(template, { name: userName, business: bizName, link, decline: '' });
}
