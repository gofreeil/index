// ─────────────────────────────────────────────────────────────
// יומן השליחות — למי נשלח כרטיס העסק, מתי, ובאיזה שם הוא נשמר.
//
// המקור הקבוע הוא השרת, לפי החשבון (api/share-log): כך הרשימה עוקבת אחרי
// המשתמש בין נייד למחשב ושורדת ניקוי דפדפן. בעבר היא ישבה ב-localStorage
// בלבד — ומי ששלח מהנייד לא ראה כלום כשנכנס לאזור האישי מהמחשב.
//
// localStorage נשאר כעותק מקומי: הוא מה שמוצג מיד (בלי המתנה לרשת), והוא
// מה שמחזיק שליחה שהשרת לא הספיק לקבל. syncShareLog() ממזג בין השניים
// ודוחף לשרת מה שחסר בו — זה גם ההעברה האוטומטית של הרשימות הישנות.
//
// יומן אחד לכל הכרטיסיות ולא אחד לכל כרטיסייה: הרשימה מוצגת במקום אחד
// בלבד — האזור האישי. פאנל השיתוף רק כותב לכאן, ולא מציג דבר.
// ─────────────────────────────────────────────────────────────
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { normalizeShareLog, shareKeyOf } from '$lib/shareLogMerge.js';

/** @typedef {import('$lib/shareLogMerge.js').ShareEntry} ShareEntry */

const KEY = 'idx-share-log';
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

function load() {
	if (!browser) return [];
	/** @type {any[]} */
	let stored = [];
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || '[]');
		if (Array.isArray(v)) stored = v;
	} catch {
		/* תוכן פגום — מתחילים מיומן ריק במקום ליפול */
	}
	return normalizeShareLog([...stored, ...drainLegacy()]);
}

export const shareLog = writable(/** @type {ShareEntry[]} */ (load()));

if (browser) {
	shareLog.subscribe((v) => {
		try {
			localStorage.setItem(KEY, JSON.stringify(v));
		} catch {
			/* גלישה פרטית / אחסון מלא — ההודעה כבר נשלחה, אין על מה להתריע */
		}
	});
}

/**
 * מאמץ תשובת שרת: מה שהשרת מחזיק + מה שנוסף כאן בינתיים. איחוד ולא
 * החלפה — שליחה שנרשמה בזמן שהבקשה הייתה בדרך לא תיעלם.
 * @param {{entries: any[], clearedAt?: number}} res
 */
function adopt(res) {
	const cut = Number(res.clearedAt) || 0;
	shareLog.update((list) =>
		normalizeShareLog([...res.entries, ...list.filter((e) => e.at > cut)])
	);
}

/**
 * דחיפת שורות לשרת. נכשל בשקט: השורה נשארת בעותק המקומי, והסנכרון הבא
 * (בכניסה לדף העסק או לאזור האישי) ידחוף אותה.
 * @param {ShareEntry[]} entries
 * @returns {Promise<boolean>}
 */
async function push(entries) {
	try {
		const res = await fetch(API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entries })
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
 * סנכרון מלא מול החשבון: מביא את הרשימה מהשרת (כולל שליחות ממכשירים
 * אחרים), ודוחף אליו כל מה שקיים רק כאן — כולל הרשימה הישנה מלפני המעבר
 * לשרת. מחזיר false כשאין חיבור או שהמשתמש לא מחובר; אז ממשיכים לעבוד
 * מהעותק המקומי.
 * @returns {Promise<boolean>}
 */
export function syncShareLog() {
	if (!browser) return Promise.resolve(false);
	inflight ??= (async () => {
		try {
			const res = await fetch(API, { headers: { Accept: 'application/json' } });
			if (!res.ok) return false;
			/** @type {{userId: string, entries: ShareEntry[], clearedAt: number}} */
			const srv = await res.json();

			let owner = '';
			try {
				owner = localStorage.getItem(OWNER_KEY) || '';
			} catch {
				/* אחסון חסום */
			}
			// עותק של חשבון אחר באותו דפדפן — לא שלך, לא מעבירים ולא מציגים
			if (owner && owner !== srv.userId) shareLog.set([]);
			try {
				localStorage.setItem(OWNER_KEY, srv.userId);
			} catch {
				/* אחסון חסום */
			}

			const have = new Map(srv.entries.map((e) => [e.key, e]));
			const mine = get(shareLog).filter((e) => e.at > srv.clearedAt);
			const missing = mine.filter((e) => {
				const s = have.get(shareKeyOf(e));
				return !s || e.at > s.at || (e.name && !s.name);
			});

			if (missing.length && (await push(missing))) return true;
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

/**
 * רישום שליחה. נקרא ברגע שנפתח הקישור — לפני שידוע שם הנמען, כדי
 * שדילוג על שאלת השם לא ימחק את השליחה מהרשימה.
 * @param {{bizId:string, bizName:string, wa:string, e164:string, pretty:string, name?:string, at:number}} entry
 * @returns {string} מפתח הרשומה, לעדכון השם בהמשך
 */
export function logShare(entry) {
	const key = shareKeyOf(entry);
	shareLog.update((list) => normalizeShareLog([{ ...entry, key }, ...list]));
	const saved = get(shareLog).find((e) => e.key === key);
	if (saved) void push([saved]);
	return key;
}

/**
 * @param {string} key
 * @param {string} name
 */
export function nameShare(key, name) {
	const clean = String(name || '')
		.trim()
		.slice(0, 60);
	shareLog.update((list) => list.map((e) => (e.key === key ? { ...e, name: clean } : e)));
	const saved = get(shareLog).find((e) => e.key === key);
	if (saved) void push([saved]);
}

/** ניקוי היומן כולו — מהאזור האישי, המקום היחיד שמציג אותו. מנקה גם בשרת. */
export async function clearShareLog() {
	shareLog.set([]);
	try {
		await fetch(API, { method: 'DELETE' });
	} catch {
		/* אין רשת — הניקוי המקומי נשאר; בסנכרון הבא הרשימה תחזור מהשרת */
	}
}
