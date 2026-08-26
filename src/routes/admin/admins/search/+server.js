import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { isSuperAdmin } from '$lib/server/strapi.js';

// ─────────────────────────────────────────────────────────────
// GET /admin/admins/search?q=… — חיפוש חי בין המשתמשים הרשומים
// (לסופר-אדמין בלבד), עבור מסך מינוי האדמינים.
//
// אסטרטגיה בשני שלבים מול רשימת המשתמשים המשותפת של Strapi:
//   1. שאילתת $containsi בצד השרת על email/username/nickname
//      (השדות המובטחים בסכמה).
//   2. אם אין תוצאות (למשל חיפוש שם בעברית שלא קיים ב-username) —
//      דפדוף מקומי על כל הרשומות והתאמה מול *כל* שדות הטקסט שלהן,
//      בתקרת סריקה קשיחה.
//   3. אין התאמה מדויקת? — התאמה עמומה (מרחק לוינשטיין) על אותם
//      שדות, כדי ששגיאת כתיב ("ahuvhnd1") עדיין תציע את הדומים
//      ("ahuvahnd1@gmail.com"). מוחזר דגל fuzzy להצגת "אולי התכוונת".
// ─────────────────────────────────────────────────────────────

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';

const PAGE_SIZE = 1000; // maxLimit של השרת
const MAX_SCAN = 5000; // תקרת רשומות לסריקה המקומית
const MAX_RESULTS = 10;

/**
 * username אוטומטי מספק OAuth (למשל google_1164…) — מזהה פנימי,
 * לא מציגים אותו לעולם.
 * @param {string} name
 */
const isMachineUsername = (name) => /^[a-z][a-z0-9]*[_-]\d{5,}$/i.test(name.trim());

/** השם האמיתי הטוב ביותר שקיים על הרשומה. @param {any} u */
const bestStrapiName = (u) => {
	const full = [u.firstname, u.lastname].filter(Boolean).join(' ').trim();
	return String(u.name || u.displayName || full || u.username || '').trim();
};

/**
 * שם תצוגה ידידותי: שם אמיתי אם קיים; אחרת נגזר מהאימייל (החלק שלפני ה-@).
 * לעולם לא מחזיר מזהה-מכונה.
 * @param {string} rawName @param {string} email
 */
function friendlyName(rawName, email) {
	const name = (rawName ?? '').trim();
	if (name && !name.includes('@') && !isMachineUsername(name)) return name;
	const local = (email ?? '').split('@')[0] ?? '';
	if (!local) return '';
	return local
		.split(/[._-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/**
 * שליפת משתמשים מ-users-permissions (מחזיר מערך גולמי, בלי מעטפת data).
 * @param {string} qs @returns {Promise<any[]>}
 */
async function fetchUsers(qs) {
	const res = await fetch(`${STRAPI_URL}/api/users?${qs}`, {
		headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
	});
	if (!res.ok) throw new Error(`strapi /api/users → ${res.status}`);
	const arr = await res.json();
	return Array.isArray(arr) ? arr : (arr?.data ?? []);
}

/** האם אחד משדות הטקסט של הרשומה מכיל את מחרוזת החיפוש. @param {any} u @param {string} q */
function matchesLocally(u, q) {
	const needle = q.toLowerCase();
	return Object.values(u).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle));
}

// ---------- התאמה עמומה (שגיאות כתיב) ----------

/** מרחק לוינשטיין קלאסי, שתי שורות בלבד. @param {string} a @param {string} b */
function levenshtein(a, b) {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			cur[j] = Math.min(
				prev[j] + 1,
				cur[j - 1] + 1,
				prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
		}
		prev = cur;
	}
	return prev[b.length];
}

/** כמה שגיאות כתיב מרשים לפי אורך החיפוש. @param {number} len */
function typoBudget(len) {
	if (len <= 4) return 1;
	if (len <= 7) return 2;
	return 3;
}

/**
 * המרחק העמום המינימלי בין החיפוש לרשומה: מושווה מול כל ערכי הטקסט,
 * מול החלק שלפני ה-@ במיילים, מול פיצול למילים, ומול קידומת באורך
 * החיפוש (כדי שגם הקלדה חלקית עם טעות תיתפס).
 * @param {any} u @param {string} q
 */
function fuzzyDistance(u, q) {
	const budget = typoBudget(q.length);
	let best = Infinity;
	for (const raw of Object.values(u)) {
		if (typeof raw !== 'string' || !raw) continue;
		const v = raw.toLowerCase();
		/** @type {Set<string>} */
		const candidates = new Set([v]);
		if (v.includes('@')) candidates.add(v.split('@')[0]);
		for (const tok of v.split(/[@._\-\s]+/)) if (tok.length >= 2) candidates.add(tok);
		for (const c of candidates) {
			// גם מול הערך המלא וגם מול קידומת באורך החיפוש
			const d = Math.min(
				levenshtein(q, c),
				c.length > q.length ? levenshtein(q, c.slice(0, q.length)) : Infinity,
				c.length > q.length + 1 ? levenshtein(q, c.slice(0, q.length + 1)) : Infinity
			);
			if (d < best) best = d;
			if (best === 0) return 0;
		}
	}
	return best <= budget ? best : Infinity;
}

// האובייקט המלא מכיל שדות רגישים — ללקוח יוצאת רק צורה רזה,
// באותו מבנה שמסך המינוי כבר מצייר (id/name/email/app_role/…).
/** @param {any} u */
const toHit = (u) => ({
	id: u.id,
	name: friendlyName(bestStrapiName(u), String(u.email ?? '')),
	email: u.email || '',
	app_role: u.app_role || 'user',
	created_at: u.createdAt || '',
	registered_site: u.registered_site || ''
});

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, url }) {
	if (!locals.user) throw error(401, 'נדרשת התחברות');
	if (!isSuperAdmin(locals.user)) throw error(403, 'פעולה זו לסופר-אדמין בלבד');

	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json({ users: [] });

	try {
		// שלב 1: שאילתה מסוננת בצד Strapi
		/** @type {any[]} */
		let matches = [];
		const enc = encodeURIComponent(q);
		try {
			matches = await fetchUsers(
				`filters[$or][0][email][$containsi]=${enc}` +
					`&filters[$or][1][username][$containsi]=${enc}` +
					`&filters[$or][2][nickname][$containsi]=${enc}` +
					`&pagination[limit]=${MAX_RESULTS * 5}`
			);
		} catch {
			// סינון לא נתמך בקונפיגורציה הזו — נמשיך לסריקה המקומית
		}

		// שלב 2: סריקה מקומית — תופסת גם שמות בעברית ושדות לא-סטנדרטיים (טלפון וכד').
		// באותו מעבר נאספות גם התאמות עמומות, למקרה שאין אף התאמה מדויקת.
		let isFuzzy = false;
		if (matches.length === 0) {
			/** @type {{ u: any, d: number }[]} */
			const fuzzyHits = [];
			for (let start = 0; start < MAX_SCAN; start += PAGE_SIZE) {
				const batch = await fetchUsers(
					`pagination[start]=${start}&pagination[limit]=${PAGE_SIZE}`
				);
				for (const u of batch) {
					if (matchesLocally(u, q)) {
						matches.push(u);
					} else {
						const d = fuzzyDistance(u, q);
						if (d !== Infinity) fuzzyHits.push({ u, d });
					}
				}
				if (batch.length < PAGE_SIZE || matches.length >= MAX_RESULTS) break;
			}
			// שלב 3: אין התאמה מדויקת — מציעים את הדומים ביותר
			if (matches.length === 0 && fuzzyHits.length > 0) {
				isFuzzy = true;
				matches = fuzzyHits.sort((a, b) => a.d - b.d).map((h) => h.u);
			}
		}

		const seen = new Set();
		/** @type {any[]} */
		const users = [];
		for (const u of matches) {
			if (!u?.id || seen.has(u.id)) continue;
			seen.add(u.id);
			users.push(toHit(u));
			if (users.length >= MAX_RESULTS) break;
		}
		return json({ users, fuzzy: isFuzzy && users.length > 0 });
	} catch (e) {
		console.error('[admin] user search failed:', e);
		return json({ users: [], error: 'החיפוש ברשימת המשתמשים נכשל — אפשר לנסות שוב' });
	}
}
