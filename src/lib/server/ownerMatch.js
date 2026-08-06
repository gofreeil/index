// ============================================================
// ownerMatch.js — מי הבעלים של כרטיסייה, ומי *יכול* להיות הבעלים שלה
//
// שתי שאלות שונות לחלוטין, ולכן שתי פונקציות שונות:
//
//   isBusinessOwner  בעלות אמיתית — שיוך שנכתב על הרשומה (user/user_id).
//                    רק היא מקנה זכות עריכה.
//   matchKind        *הצעה* — הטלפון או האימייל של המשתמש זהים לאלה
//                    שעל הכרטיסייה. זה סימן מצוין, אבל לא הוכחה: הטלפון
//                    בפרופיל הוא נתון מוצהר שהמשתמש עצמו עורך. לכן התאמה
//                    רק פותחת בקשת בעלות, ואדמין הוא שמכריע.
//
// כל 92 הכרטיסיות שהוזרמו בייבוא נוצרו בלי שיוך-משתמש, ולאוסף idx-business
// אין עמודת אימייל — ולכן אימייל הבעלים נשמר ב-extra_fields.owner_email
// (עמודת json חופשית), והטלפון הוא מפתח ההתאמה העיקרי.
//
// עלות: שתי רשימות רזות (93 כרטיסיות, 121 משתמשים) עם מטמון של 5 דקות,
// והצלבה בזיכרון — במקום קריאת רשת לכל כרטיסייה בנפרד.
// ============================================================

import { canonicalPhoneKey } from '$lib/phoneIL.js';
import { getUserPhone, isPrivileged, listBusinessesForMatch, listUsersSlim } from './strapi.js';
import { listClaims, listClaimsByUser } from './claimsStore.js';

const TTL_MS = 5 * 60 * 1000;
// המונה של המשתמש נקרא בכל טעינת עמוד (הבועה בהאדר) — מטמון ארוך יותר
const USER_TTL_MS = 10 * 60 * 1000;

/** מזהה הבעלים של כרטיסייה, או '' אם אין לה בעלים. @param {any} b */
export function businessOwnerId(b) {
	return String(b?.user_id ?? '') || String(b?.user?.id ?? '');
}

/** אימייל הבעלים שנשמר ב-extra_fields (לאוסף אין עמודת email). @param {any} b */
export function businessOwnerEmail(b) {
	return String(b?.extra_fields?.owner_email ?? '')
		.trim()
		.toLowerCase();
}

/**
 * האם המשתמש המחובר הוא הבעלים הרשום של הכרטיסייה. בעלות = שיוך שנכתב
 * על הרשומה (בהגשה דרך הטופס, או באישור בקשת בעלות), ולא התאמת פרטים.
 * @param {any} b רשומת idx-business הגולמית @param {any} user locals.user
 */
export function isBusinessOwner(b, user) {
	const uid = String(user?.id ?? '');
	return !!uid && businessOwnerId(b) === uid;
}

/**
 * מי רשאי לערוך את הכרטיסייה: הבעלים הרשום, וכל אדמין.
 * @param {any} b @param {any} user
 */
export function canEditBusiness(b, user) {
	return isPrivileged(user) || isBusinessOwner(b, user);
}

/**
 * איך המשתמש מתחבר לכרטיסייה, אם בכלל. '' = אין קשר.
 * @param {any} b @param {{email?: string, phone?: string}} u
 * @returns {''|'phone'|'email'}
 */
export function matchKind(b, u) {
	const bizPhone = canonicalPhoneKey(b?.phone);
	if (bizPhone && bizPhone === canonicalPhoneKey(u?.phone)) return 'phone';
	const email = String(u?.email ?? '')
		.trim()
		.toLowerCase();
	if (email && email === businessOwnerEmail(b)) return 'email';
	return '';
}

// ── רשימות רזות עם מטמון ─────────────────────────────────────

/** @type {{at: number, rows: any[]} | null} */
let bizCache = null;
/** @type {{at: number, rows: any[]} | null} */
let usersCache = null;
/** @type {{at: number, rows: any[]} | null} */
let allBizCache = null;
/** @type {Map<string, {at: number, n: number}>} */
const userCountCache = new Map();

/**
 * מאפס את כל מטמוני ההתאמה — אחרי שיוך בעלים, שינוי טלפון או בקשה
 * חדשה, כדי שהמסכים והבועה יראו את המצב האמיתי מיד.
 */
export function invalidateMatches() {
	bizCache = null;
	allBizCache = null;
	usersCache = null;
	userCountCache.clear();
}

/** כל הכרטיסיות בשדות ההתאמה בלבד, ממוטמנות. @returns {Promise<any[]>} */
async function allBusinesses() {
	if (allBizCache && Date.now() - allBizCache.at < TTL_MS) return allBizCache.rows;
	const rows = await listBusinessesForMatch();
	allBizCache = { at: Date.now(), rows };
	return rows;
}

/** כרטיסיות פנויות לשיוך: בלי בעלים, ולא כאלה שנדחו. @returns {Promise<any[]>} */
async function unownedBusinesses() {
	if (bizCache && Date.now() - bizCache.at < TTL_MS) return bizCache.rows;
	const all = await allBusinesses();
	const rows = all.filter((b) => !businessOwnerId(b) && b.status !== 'rejected');
	bizCache = { at: Date.now(), rows };
	return rows;
}

/**
 * מצב הבעלות של כרטיסיות מסוימות — מסך הבקשות צריך לדעת אם הבקשה שלפניו
 * היא שיוך ראשון או *העברה* מבעלים קיים. נשען על אותה רשימה ממוטמנת של
 * מנוע ההתאמה, ולכן לא עולה קריאת רשת לכל בקשה. נכשל בשקט (מפה ריקה).
 * @param {string[]} docIds
 * @returns {Promise<Map<string, {ownerId: string, ownerEmail: string}>>}
 */
export async function ownershipByDoc(docIds) {
	/** @type {Map<string, {ownerId: string, ownerEmail: string}>} */
	const out = new Map();
	const want = new Set(docIds.filter(Boolean));
	if (!want.size) return out;
	try {
		for (const b of await allBusinesses()) {
			if (!want.has(b.documentId)) continue;
			out.set(b.documentId, {
				ownerId: businessOwnerId(b),
				ownerEmail: businessOwnerEmail(b)
			});
		}
	} catch (e) {
		console.error('[match] ownership lookup failed:', e instanceof Error ? e.message : e);
	}
	return out;
}

/** @returns {Promise<{id:string,email:string,phone:string,name:string}[]>} */
async function allUsers() {
	if (usersCache && Date.now() - usersCache.at < TTL_MS) return usersCache.rows;
	const rows = await listUsersSlim();
	usersCache = { at: Date.now(), rows };
	return rows;
}

/**
 * @typedef {Object} BizMatch
 * @property {string} documentId
 * @property {string} name
 * @property {string} city
 * @property {string} category
 * @property {string} status
 * @property {'phone'|'email'} matchedBy
 */

/**
 * הכרטיסיות הפנויות שנראות שייכות למשתמש הזה. נכשל בשקט (רשימה ריקה) —
 * תקלה במנוע ההתאמה לא תפיל את האזור האישי.
 * @param {{id?: string|number, email?: string, phone?: string}} user
 * @returns {Promise<BizMatch[]>}
 */
export async function findMatchesForUser(user) {
	const hasKey = canonicalPhoneKey(user?.phone) || String(user?.email ?? '').trim();
	if (!hasKey) return [];
	try {
		const rows = await unownedBusinesses();
		/** @type {BizMatch[]} */
		const out = [];
		for (const b of rows) {
			const kind = matchKind(b, user);
			if (!kind) continue;
			out.push({
				documentId: b.documentId,
				name: b.name || '',
				city: b.city || '',
				category: b.category || '',
				status: b.status || 'pending',
				matchedBy: kind
			});
		}
		return out;
	} catch (e) {
		console.error('[match] user matches failed:', e instanceof Error ? e.message : e);
		return [];
	}
}

/**
 * כמה כרטיסיות מחכות למשתמש הזה שידרוש אותן — המספר שבבועה האדומה
 * שעל האווטאר בהאדר. נקרא בכל טעינת עמוד של משתמש מחובר, ולכן ממוטמן
 * לעשר דקות לכל משתמש; כל הכשלים שקטים (0).
 * @param {{id?: string|number, email?: string}} user
 * @returns {Promise<number>}
 */
export async function countMatchesForUser(user) {
	const key = String(user?.id ?? '');
	if (!key) return 0;
	const hit = userCountCache.get(key);
	if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.n;
	try {
		const phone = await getUserPhone(key);
		const [matches, claims] = await Promise.all([
			findMatchesForUser({ id: key, email: user.email, phone }),
			listClaimsByUser(key)
		]);
		// כרטיסייה שכבר נדרשה (או שהבקשה עליה הוכרעה) אינה "מחכה לו"
		const n = matches.filter((m) => !claims.some((c) => c.bizDocId === m.documentId)).length;
		userCountCache.set(key, { at: Date.now(), n });
		return n;
	} catch {
		return 0;
	}
}

/**
 * @typedef {Object} AutoMatch
 * @property {string} bizDocId
 * @property {string} bizName
 * @property {string} bizPhone
 * @property {string} bizCity
 * @property {string} bizStatus
 * @property {string} userId
 * @property {string} userName
 * @property {string} userEmail
 * @property {string} userPhone
 * @property {'phone'|'email'} matchedBy
 * @property {'none'|'pending'|'rejected'|'dismissed'} claim מצב הבקשה, אם כבר יש
 */

/**
 * כל ההתאמות שהמערכת מוצאת בין משתמשים רשומים לכרטיסיות פנויות — המסך
 * שבו האדמין רואה "יש בעלים לכרטיסייה הזו, הוא פשוט עוד לא ביקש אותה".
 * זוגות שכבר הוכרעו (אושרו/נדחו/סומנו "התעלם") לא חוזרים.
 * @returns {Promise<AutoMatch[]>}
 */
export async function listAutoMatches() {
	try {
		const [businesses, users, claims] = await Promise.all([
			unownedBusinesses(),
			allUsers(),
			listClaims()
		]);

		/** @type {Map<string, typeof users>} */
		const byPhone = new Map();
		/** @type {Map<string, typeof users>} */
		const byEmail = new Map();
		for (const u of users) {
			const pk = canonicalPhoneKey(u.phone);
			if (pk) byPhone.set(pk, [...(byPhone.get(pk) ?? []), u]);
			const em = u.email.trim().toLowerCase();
			if (em) byEmail.set(em, [...(byEmail.get(em) ?? []), u]);
		}

		/** @type {Map<string, string>} */
		const claimState = new Map();
		for (const c of claims) claimState.set(`${c.bizDocId}|${c.userId}`, c.status);

		/** @type {AutoMatch[]} */
		const out = [];
		for (const b of businesses) {
			/** @type {Map<string, 'phone'|'email'>} */
			const hits = new Map();
			for (const u of byPhone.get(canonicalPhoneKey(b.phone)) ?? []) hits.set(u.id, 'phone');
			for (const u of byEmail.get(businessOwnerEmail(b)) ?? []) {
				if (!hits.has(u.id)) hits.set(u.id, 'email');
			}
			for (const [userId, matchedBy] of hits) {
				const state = claimState.get(`${b.documentId}|${userId}`);
				// אושר = לכרטיסייה כבר יש בעלים; נדחה/התעלם = הוכרע ולא חוזר
				if (state === 'approved' || state === 'rejected' || state === 'dismissed') continue;
				const u = users.find((x) => x.id === userId);
				out.push({
					bizDocId: b.documentId,
					bizName: b.name || '',
					bizPhone: b.phone || '',
					bizCity: b.city || '',
					bizStatus: b.status || 'pending',
					userId,
					userName: u?.name ?? '',
					userEmail: u?.email ?? '',
					userPhone: u?.phone ?? '',
					matchedBy,
					claim: state === 'pending' ? 'pending' : 'none'
				});
			}
		}
		return out;
	} catch (e) {
		console.error('[match] auto matches failed:', e instanceof Error ? e.message : e);
		return [];
	}
}

/**
 * כמה התאמות ממתינות לטיפול האדמין — התאמות שהמערכת מצאה ואיש עוד לא
 * דרש את הכרטיסייה. הבקשות שהמשתמשים כן שלחו נספרות בנפרד (claimsStore).
 * @returns {Promise<number>}
 */
export async function countOpenMatches() {
	const matches = await listAutoMatches();
	return matches.filter((m) => m.claim === 'none').length;
}
