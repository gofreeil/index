// ─────────────────────────────────────────────────────────────
// יומן השליחות — למי נשלח כרטיס העסק, מתי, באיזה שם הוא נשמר, ומה
// הערה/תזכורת יש לכל נמען.
//
// המקור הקבוע הוא השרת, לפי החשבון (api/share-log): כך הרשימה עוקבת אחרי
// המשתמש בין נייד למחשב ושורדת ניקוי דפדפן. בעבר היא ישבה ב-localStorage
// בלבד — ומי ששלח מהנייד לא ראה כלום כשנכנס לאזור האישי מהמחשב.
//
// localStorage נשאר כעותק מקומי: הוא מה שמוצג מיד (בלי המתנה לרשת), והוא
// מה שמחזיק שינוי שהשרת לא הספיק לקבל. syncShareLog() ממזג בין השניים
// ודוחף לשרת מה שחסר בו — זה גם ההעברה האוטומטית של הרשימות הישנות.
// כללי המיזוג יושבים ב-shareLogMerge.js (משותף ללקוח ולשרת).
//
// יומן אחד לכל הכרטיסיות ולא אחד לכל כרטיסייה: הרשימה מוצגת במקום אחד
// בלבד — האזור האישי. פאנל השיתוף רק כותב לכאן, ולא מציג דבר.
// ─────────────────────────────────────────────────────────────
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { cleanRemoved, normalizeShareLog, shareKeyOf } from '$lib/shareLogMerge.js';

/** @typedef {import('$lib/shareLogMerge.js').ShareEntry} ShareEntry */

const KEY = 'idx-share-log';
/** מצבות מחיקה שעוד לא אושרו בשרת: { מפתח שורה: זמן מחיקה }. */
const REMOVED_KEY = 'idx-share-removed';
/** מי החשבון שהעותק המקומי שייך לו — דפדפן משותף לשני חשבונות לא יעביר רשימה מאחד לשני. */
const OWNER_KEY = 'idx-share-log-owner';
/** הגרסה הקודמת שמרה רשימה נפרדת לכל כרטיסייה תחת המפתח הזה + מזהה. */
const LEGACY_PREFIX = 'idx-smart-share:';
const API = '/api/share-log';

/**
 * שאיבת הרשימות הישנות (אחת לכל כרטיסייה) אל היומן המאוחד, ומחיקתן.
 * רץ פעם אחת בלבד — בטעינה הראשונה אחרי העדכון.
 * @returns {any[]}
 */
function drainLegacy() {
	/** @type {any[]} */
	const out = [];
	try {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith(LEGACY_PREFIX));
		for (const k of keys) {
			const bizId = k.slice(LEGACY_PREFIX.length);
			try {
				const arr = JSON.parse(localStorage.getItem(k) || '[]');
				if (Array.isArray(arr)) for (const e of arr) out.push({ ...e, bizId });
			} catch {
				/* תוכן פגום — הרשומה פשוט לא עוברת */
			}
			localStorage.removeItem(k);
		}
	} catch {
		/* אחסון חסום — אין מה להעביר */
	}
	return out;
}

/** @param {string} key */
function readJson(key) {
	try {
		return JSON.parse(localStorage.getItem(key) || 'null');
	} catch {
		return null; // תוכן פגום — מתחילים מריק במקום ליפול
	}
}

/** @param {string} key @param {any} value */
function writeJson(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* גלישה פרטית / אחסון מלא — השינוי כבר בוצע, אין על מה להתריע */
	}
}

function load() {
	if (!browser) return [];
	const stored = readJson(KEY);
	return normalizeShareLog([...(Array.isArray(stored) ? stored : []), ...drainLegacy()]);
}

export const shareLog = writable(/** @type {ShareEntry[]} */ (load()));

/**
 * מפתח השורה שצריך להבליט כשנכנסים לטבלה. השיתוף החכם קובע אותו ברגע
 * ששם הנמען נשמר, ו-SentList צורך אותו (ומאפס) כשהוא נטען. store בזיכרון
 * ולא פרמטר ב-URL: מפתח השורה כולל את מספר הטלפון של הנמען, ואסור שהוא
 * יישב בהיסטוריית הדפדפן.
 */
export const revealKey = writable('');

/** מצבות מחיקה שממתינות לאישור השרת. */
let pendingRemoved = /** @type {Record<string, number>} */ (
	browser ? cleanRemoved(readJson(REMOVED_KEY)) : {}
);

/** @param {Record<string, number>} next */
function setPendingRemoved(next) {
	pendingRemoved = next;
	if (browser) writeJson(REMOVED_KEY, next);
}

if (browser) {
	shareLog.subscribe((v) => writeJson(KEY, v));
}

/**
 * מאמץ תשובת שרת: מה שהשרת מחזיק + מה שנוסף כאן בינתיים. איחוד ולא
 * החלפה — שינוי שנרשם בזמן שהבקשה הייתה בדרך לא ייעלם. מצבה שהשרת כבר
 * מכיר יוצאת מהתור המקומי.
 * @param {{entries: any[], clearedAt?: number, removed?: Record<string, number>}} res
 */
function adopt(res) {
	const srvRemoved = cleanRemoved(res.removed);
	/** @type {Record<string, number>} */
	const stillPending = {};
	for (const [k, ts] of Object.entries(pendingRemoved)) {
		if ((srvRemoved[k] || 0) < ts) stillPending[k] = ts;
	}
	setPendingRemoved(stillPending);
	const gate = {
		clearedAt: Number(res.clearedAt) || 0,
		removed: { ...srvRemoved, ...stillPending }
	};
	shareLog.update((list) => normalizeShareLog([...res.entries, ...list], gate));
}

/**
 * דחיפת שינוי לשרת. נכשל בשקט: השינוי נשאר בעותק המקומי, והסנכרון הבא
 * (בכניסה לדף העסק או לאזור האישי) ידחוף אותו.
 * @param {{entries?: ShareEntry[], removed?: Record<string, number>}} change
 * @returns {Promise<boolean>}
 */
async function push(change) {
	try {
		const res = await fetch(API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(change)
		});
		if (!res.ok) return false;
		adopt(await res.json());
		return true;
	} catch {
		return false;
	}
}

/** @type {Promise<boolean> | null} */
let inflight = null;

/**
 * סנכרון מלא מול החשבון: מביא את הרשימה מהשרת (כולל שליחות ועריכות
 * ממכשירים אחרים), ודוחף אליו כל מה שקיים רק כאן — כולל הרשימה הישנה
 * מלפני המעבר לשרת. מחזיר false כשאין חיבור או שהמשתמש לא מחובר; אז
 * ממשיכים לעבוד מהעותק המקומי.
 * @returns {Promise<boolean>}
 */
export function syncShareLog() {
	if (!browser) return Promise.resolve(false);
	inflight ??= (async () => {
		try {
			const res = await fetch(API, { headers: { Accept: 'application/json' } });
			if (!res.ok) return false;
			/** @type {{userId: string, entries: ShareEntry[], clearedAt: number, removed: Record<string, number>}} */
			const srv = await res.json();

			let owner = '';
			try {
				owner = localStorage.getItem(OWNER_KEY) || '';
			} catch {
				/* אחסון חסום */
			}
			// עותק של חשבון אחר באותו דפדפן — לא שלך, לא מעבירים ולא מציגים
			if (owner && owner !== srv.userId) {
				shareLog.set([]);
				setPendingRemoved({});
			}
			try {
				localStorage.setItem(OWNER_KEY, srv.userId);
			} catch {
				/* אחסון חסום */
			}

			const have = new Map(srv.entries.map((e) => [e.key, e]));
			const mine = get(shareLog).filter((e) => e.upd > srv.clearedAt);
			const missing = mine.filter((e) => {
				const s = have.get(shareKeyOf(e));
				return !s || e.upd > s.upd || e.at > s.at;
			});
			const hasRemoved = Object.keys(pendingRemoved).length > 0;

			if ((missing.length || hasRemoved) && (await push({ entries: missing, removed: pendingRemoved })))
				return true;
			adopt(srv);
			return true;
		} catch {
			return false;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/** @param {string} key @returns {ShareEntry | undefined} */
const find = (key) => get(shareLog).find((e) => e.key === key);

/**
 * רישום שליחה. נקרא ברגע שנפתח הקישור — לפני שידוע שם הנמען, כדי
 * שדילוג על שאלת השם לא ימחק את השליחה מהרשימה. שליחה חוזרת לאותו נמען
 * מעדכנת את התאריך ושומרת את מה שכבר נכתב עליו (שם, הערה, תזכורת).
 * @param {{bizId:string, bizName:string, wa:string, e164:string, pretty:string, name?:string, at:number}} entry
 * @returns {string} מפתח הרשומה, לעדכון השם בהמשך
 */
export function logShare(entry) {
	const key = shareKeyOf(entry);
	const prev = find(key);
	const next = /** @type {ShareEntry} */ ({
		note: '',
		remindAt: 0,
		...prev,
		...entry,
		key,
		name: prev?.name || entry.name || '',
		upd: Date.now()
	});
	shareLog.update((list) => normalizeShareLog([next, ...list]));
	const saved = find(key);
	if (saved) void push({ entries: [saved] });
	return key;
}

/**
 * עריכת שורה: שם, הערה או זמן תזכורת (0 = ביטול תזכורת).
 * @param {string} key
 * @param {{name?: string, note?: string, remindAt?: number}} patch
 */
export function updateShare(key, patch) {
	/** @type {Partial<ShareEntry>} */
	const clean = {};
	if (patch.name !== undefined) clean.name = String(patch.name).trim().slice(0, 60);
	if (patch.note !== undefined) clean.note = String(patch.note).trim().slice(0, 300);
	if (patch.remindAt !== undefined) clean.remindAt = Math.max(0, Number(patch.remindAt) || 0);
	const cur = find(key);
	if (!cur) return;
	shareLog.update((list) =>
		list.map((e) => (e.key === key ? { ...e, ...clean, upd: Date.now() } : e))
	);
	const saved = find(key);
	if (saved) void push({ entries: [saved] });
}

/**
 * @param {string} key
 * @param {string} name
 */
export function nameShare(key, name) {
	updateShare(key, { name });
}

/**
 * מחיקת שורה בודדת. מחזיר אותה לצורך "ביטול" (restoreShare).
 * @param {string} key
 * @returns {ShareEntry | null}
 */
export function removeShare(key) {
	const cur = find(key);
	if (!cur) return null;
	const ts = Date.now();
	shareLog.update((list) => list.filter((e) => e.key !== key));
	setPendingRemoved({ ...pendingRemoved, [key]: ts });
	void push({ removed: { [key]: ts } });
	return cur;
}

/**
 * ביטול מחיקה: השורה חוזרת עם זמן עדכון חדש, שחדש מהמצבה — וכך גם
 * השרת וגם המכשירים האחרים מקבלים אותה בחזרה.
 * @param {ShareEntry} entry
 */
export function restoreShare(entry) {
	const { [entry.key]: _drop, ...rest } = pendingRemoved;
	setPendingRemoved(rest);
	const back = { ...entry, upd: Date.now() };
	shareLog.update((list) => normalizeShareLog([back, ...list]));
	void push({ entries: [back] });
}

/** ניקוי היומן כולו — מהאזור האישי, המקום היחיד שמציג אותו. מנקה גם בשרת. */
export async function clearShareLog() {
	shareLog.set([]);
	setPendingRemoved({});
	try {
		await fetch(API, { method: 'DELETE' });
	} catch {
		/* אין רשת — הניקוי המקומי נשאר; בסנכרון הבא הרשימה תחזור מהשרת */
	}
}
