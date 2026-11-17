// ─────────────────────────────────────────────────────────────
// shareLogMerge.js — איחוד רשימות "למי שלחתי". קוד טהור, משותף ללקוח
// (shareLog.js) ולשרת (server/shareLogStore.js): שני הצדדים חייבים למזג
// באותה דרך, אחרת הרשימה בשרת והרשימה בדפדפן היו מתרחקות זו מזו.
//
// כללי המיזוג (נבדקו מול סנכרון בין שני מכשירים):
//   • שורה = כרטיסייה + מספר. שליחה חוזרת מעדכנת את התאריך, לא מוסיפה שורה.
//   • השדות הניתנים לעריכה (שם, הערה, תזכורת) נלקחים מהגרסה שנערכה
//     אחרונה (upd) — לא מהשליחה האחרונה. עריכה במכשיר אחד לא נדרסת
//     בגלל שליחה ישנה יותר שהגיעה ממכשיר אחר.
//   • מחיקה היא "מצבה" (removed[key] = זמן המחיקה): שורה שנערכה/נשלחה
//     אחרי המחיקה חיה, ישנה ממנה — נמחקת. כך גם "ביטול מחיקה" פשוט
//     עדכון חדש של השורה, בלי מנגנון נפרד.
// ─────────────────────────────────────────────────────────────

export const SHARE_LOG_MAX = 200;
/** כמה מצבות מחיקה נשמרות — הישנות כבר לא משנות, כי השורה שלהן נעלמה מכל המכשירים. */
export const SHARE_LOG_MAX_REMOVED = 300;

/**
 * @typedef {Object} ShareEntry
 * @property {string} key     מזהה הרשומה: כרטיסייה + מספר (גם מפתח הכפילות)
 * @property {string} wa      ספרות בפורמט בינלאומי, לקישור wa.me
 * @property {string} e164    פורמט בינלאומי עם +, לקישור sms:
 * @property {string} pretty  המספר כפי שמוצג למשתמש
 * @property {string} name    שם הנמען — נשאל רק אחרי השליחה, ולכן יכול להישאר ריק
 * @property {string} note    הערה חופשית של השולח
 * @property {number} remindAt זמן התזכורת (ms), 0 = אין
 * @property {number} at      חותמת הזמן של השליחה האחרונה
 * @property {number} upd     חותמת הזמן של העדכון האחרון של השורה (שליחה או עריכה)
 * @property {string} bizId
 * @property {string} bizName
 */

/** @param {any} e */
export const shareKeyOf = (e) => `${e?.bizId || ''}|${e?.wa || ''}`;

const YEAR_MS = 365 * 24 * 3600 * 1000;

/**
 * זמן תזכורת סביר או 0. הפונקציה רצה בשרת על קלט מהדפדפן, ולכן חוסמת
 * ערכים מופרכים (שנת 1970, שנת 9999) שהיו שוברים את התצוגה.
 * @param {any} v
 */
function cleanRemind(v) {
	const n = Number(v);
	if (!Number.isFinite(n) || n <= 0) return 0;
	const now = Date.now();
	return n > now - YEAR_MS && n < now + 5 * YEAR_MS ? Math.round(n) : 0;
}

/**
 * @param {any} raw
 * @returns {ShareEntry | null}
 */
function sanitize(raw) {
	const wa = String(raw?.wa ?? '').replace(/\D/g, '');
	if (wa.length < 8 || wa.length > 15) return null;
	const at = Number(raw.at) || 0;
	/** @type {ShareEntry} */
	const entry = {
		key: '',
		wa,
		e164: String(raw.e164 || '').slice(0, 20),
		pretty: String(raw.pretty || raw.e164 || wa).slice(0, 30),
		name: String(raw.name || '')
			.trim()
			.slice(0, 60),
		note: String(raw.note || '')
			.trim()
			.slice(0, 300),
		remindAt: cleanRemind(raw.remindAt),
		at,
		// רשומות שנכתבו לפני שהיה upd: זמן השליחה הוא גם זמן העדכון שלהן
		upd: Number(raw.upd) || at,
		bizId: String(raw.bizId || '').slice(0, 80),
		bizName: String(raw.bizName || '').slice(0, 120)
	};
	entry.key = shareKeyOf(entry);
	return entry;
}

/**
 * @typedef {Object} Gate
 * @property {number} [clearedAt]               "ניקוי הרשימה" — מוחק כל מה שעודכן לפניו
 * @property {Record<string, number>} [removed] מצבות מחיקה לפי מפתח שורה
 */

/**
 * איחוד + ניקוי: רשומה בלי מספר תקין נזרקת, שדות נחתכים לאורך סביר (קלט
 * מהדפדפן), כפילויות מתמזגות לפי הכללים שבראש הקובץ, ושורות שנמחקו
 * (מצבה חדשה מהן) נגרעות.
 * @param {any[]} list
 * @param {Gate} [gate]
 * @returns {ShareEntry[]}
 */
export function normalizeShareLog(list, gate = {}) {
	const cleared = Number(gate.clearedAt) || 0;
	const removed = gate.removed || {};
	/** @type {Map<string, ShareEntry>} */
	const byKey = new Map();
	for (const raw of Array.isArray(list) ? list : []) {
		const entry = sanitize(raw);
		if (!entry) continue;
		const prev = byKey.get(entry.key);
		if (!prev) {
			byKey.set(entry.key, entry);
			continue;
		}
		const [win, lose] = entry.upd >= prev.upd ? [entry, prev] : [prev, entry];
		byKey.set(entry.key, {
			...win,
			at: Math.max(entry.at, prev.at),
			// שדות שהם תיאור ולא עריכה — משלימים מהגרסה הישנה אם חסרים
			bizName: win.bizName || lose.bizName,
			e164: win.e164 || lose.e164
		});
	}
	return [...byKey.values()]
		.filter((e) => e.upd > cleared && e.upd > (Number(removed[e.key]) || 0))
		.sort((a, b) => b.at - a.at)
		.slice(0, SHARE_LOG_MAX);
}

/**
 * מצבות מחיקה נקיות וחתוכות — לפני שמירה בשרת או שליחה אליו.
 * @param {any} raw
 * @returns {Record<string, number>}
 */
export function cleanRemoved(raw) {
	/** @type {Record<string, number>} */
	const out = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const [k, v] of Object.entries(raw)) {
		const ts = Number(v);
		if (k.length <= 120 && k.includes('|') && Number.isFinite(ts) && ts > 0) out[k] = ts;
	}
	const top = Object.entries(out)
		.sort((a, b) => b[1] - a[1])
		.slice(0, SHARE_LOG_MAX_REMOVED);
	return Object.fromEntries(top);
}
