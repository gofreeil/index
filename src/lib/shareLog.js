// ─────────────────────────────────────────────────────────────
// יומן השליחות — למי נשלח כרטיס העסק, מתי, ובאיזה שם הוא נשמר.
//
// הכול נשאר בדפדפן (localStorage): מספרי טלפון של מכרים הם מידע של צד
// שלישי ואין סיבה שיגיע לשרת. המחיר הוא שהרשימה לא עוברת בין מכשירים
// ונעלמת עם ניקוי הדפדפן — זו רשימת עזר, לא מאגר לקוחות.
//
// יומן אחד לכל הכרטיסיות ולא אחד לכל כרטיסייה: הרשימה מוצגת במקום אחד
// בלבד — האזור האישי. פאנל השיתוף רק כותב לכאן, ולא מציג דבר.
// ─────────────────────────────────────────────────────────────
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'idx-share-log';
/** הגרסה הקודמת שמרה רשימה נפרדת לכל כרטיסייה תחת המפתח הזה + מזהה. */
const LEGACY_PREFIX = 'idx-smart-share:';
const MAX = 200;

/**
 * @typedef {Object} ShareEntry
 * @property {string} key     מזהה הרשומה: כרטיסייה + מספר (גם מפתח הכפילות)
 * @property {string} wa      ספרות בפורמט בינלאומי, לקישור wa.me
 * @property {string} e164    פורמט בינלאומי עם +, לקישור sms:
 * @property {string} pretty  המספר כפי שמוצג למשתמש
 * @property {string} name    שם הנמען — נשאל רק אחרי השליחה, ולכן יכול להישאר ריק
 * @property {number} at      חותמת הזמן של השליחה האחרונה
 * @property {string} bizId
 * @property {string} bizName
 */

/** @param {any} e */
const keyOf = (e) => `${e?.bizId || ''}|${e?.wa || ''}`;

/**
 * שליחה חוזרת לאותו מספר מאותה כרטיסייה מעדכנת את התאריך במקום להוסיף
 * שורה — הטבלה היא "למי שלחתי", לא יומן ניסיונות. שם שכבר נשמר לא נמחק
 * על ידי שליחה מאוחרת שהגיעה בלי שם.
 * @param {any[]} list
 * @returns {ShareEntry[]}
 */
function normalize(list) {
	/** @type {Map<string, ShareEntry>} */
	const byKey = new Map();
	for (const raw of list) {
		if (!raw?.wa) continue;
		const key = keyOf(raw);
		const entry = {
			key,
			wa: String(raw.wa),
			e164: String(raw.e164 || ''),
			pretty: String(raw.pretty || raw.e164 || raw.wa),
			name: String(raw.name || ''),
			at: Number(raw.at) || 0,
			bizId: String(raw.bizId || ''),
			bizName: String(raw.bizName || '')
		};
		const prev = byKey.get(key);
		if (!prev) byKey.set(key, entry);
		else if (entry.at >= prev.at)
			byKey.set(key, {
				...entry,
				name: entry.name || prev.name,
				bizName: entry.bizName || prev.bizName
			});
		else
			byKey.set(key, {
				...prev,
				name: prev.name || entry.name,
				bizName: prev.bizName || entry.bizName
			});
	}
	return [...byKey.values()].sort((a, b) => b.at - a.at).slice(0, MAX);
}

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
	return normalize([...stored, ...drainLegacy()]);
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
 * רישום שליחה. נקרא ברגע שנפתח הקישור — לפני שידוע שם הנמען, כדי
 * שדילוג על שאלת השם לא ימחק את השליחה מהרשימה.
 * @param {{bizId:string, bizName:string, wa:string, e164:string, pretty:string, name?:string, at:number}} entry
 * @returns {string} מפתח הרשומה, לעדכון השם בהמשך
 */
export function logShare(entry) {
	const key = keyOf(entry);
	shareLog.update((list) => normalize([{ ...entry, key }, ...list]));
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
}

/** ניקוי היומן כולו — מהאזור האישי, המקום היחיד שמציג אותו. */
export function clearShareLog() {
	shareLog.set([]);
}
