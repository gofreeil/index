import { randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

// ─────────────────────────────────────────────────────────────
// קליינט server-only ל-Strapi המשותף (api.gofreeil.com).
// כל הכתיבות (טופס עסק, ביקורות, מונים) עוברות דרך כאן עם STRAPI_TOKEN —
// הטוקן לעולם לא מגיע לדפדפן. אוסף העסקים מבודד תחת prefix idx-.
//
// Auth (מאובטח): אין יותר סיסמה דטרמיניסטית מ-Google-ID. משתמש Google מקבל
// JWT אמיתי דרך /api/sso/issue-jwt (שרת-לשרת עם STRAPI_TOKEN); אם אינו קיים,
// נרשם עם סיסמה אקראית (randomBytes) שלא נשמרת ולא ניתנת לגזירה — וממשיך דרך
// issue-jwt. ה-JWT נשמר ב-cookie httpOnly, לא ב-localStorage.
// ─────────────────────────────────────────────────────────────

export const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	const bearer = init.token ?? TOKEN;
	if (bearer) headers.Authorization = `Bearer ${bearer}`;
	if (init.body && !headers['Content-Type'] && !(init.body instanceof FormData)) {
		headers['Content-Type'] = 'application/json';
	}
	const res = await fetch(`${STRAPI_URL}${path}`, { ...init, headers });
	return res;
}

/** @param {string} path @param {any} [init] */
async function apiJson(path, init) {
	const res = await api(path, init);
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`strapi ${path} → ${res.status} ${text.slice(0, 300)}`);
	}
	return res.json();
}

// ── Auth (רשימת המשתמשים המאוחדת) ────────────────────────────

/** @param {string} identifier @param {string} password @returns {Promise<{jwt:string,user:any}>} */
export async function strapiLogin(identifier, password) {
	return apiJson('/api/auth/local', {
		method: 'POST',
		body: JSON.stringify({ identifier, password })
	});
}

/** @param {string} username @param {string} email @param {string} password @returns {Promise<{jwt:string,user:any}>} */
export async function strapiRegister(username, email, password) {
	return apiJson('/api/auth/local/register', {
		method: 'POST',
		body: JSON.stringify({ username, email, password })
	});
}

/**
 * שם תצוגה ידידותי. username אוטומטי מספק OAuth (google_/facebook_/github_ + ספרות)
 * הוא מזהה פנימי של Strapi — לא מציגים אותו גולמי; נופלים לחלק שלפני @ במייל.
 * @param {any} u אובייקט משתמש עם username/email
 * @returns {string}
 */
export function displayName(u) {
	const username = String(u?.username ?? '').trim();
	const email = String(u?.email ?? '');
	const isAutoUsername = /^google_\d+$|^facebook_\d+$|^github_\d+$/.test(username);
	if (username && !isAutoUsername) return username;
	return email.split('@')[0] || username || email;
}

/** אימות JWT → פרטי המשתמש, או null. @param {string} jwt */
export async function getStrapiMe(jwt) {
	if (!jwt) return null;
	try {
		const res = await api('/api/users/me', { token: jwt, signal: AbortSignal.timeout(6000) });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/** מנפיק JWT אמיתי למשתמש קיים לפי אימייל (שרת-לשרת). @param {string} email @returns {Promise<string|null>} */
async function issueSsoJwt(email) {
	if (!TOKEN) return null;
	const res = await api('/api/sso/issue-jwt', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	return data?.jwt ?? null;
}

/**
 * לוגין-או-provisioning למשתמש Google, מאובטח. מחזיר JWT אמיתי + פרטי המשתמש.
 * @param {string} email @param {string} name
 * @returns {Promise<{jwt:string, user:{id:string,name:string,email:string}}|null>}
 */
export async function strapiGoogleUpsert(email, name) {
	const emailLc = String(email).trim().toLowerCase();
	// קיים? מנפיקים JWT ישירות.
	let jwt = await issueSsoJwt(emailLc);
	if (!jwt) {
		// לא קיים — נרשמים עם סיסמה אקראית שלא נשמרת (ולכן לא ניתנת לגזירה), ומקבלים JWT.
		const username =
			(emailLc.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) +
			'_' +
			randomBytes(3).toString('hex');
		const password = randomBytes(32).toString('base64url');
		try {
			const reg = await strapiRegister(username, emailLc, password);
			jwt = reg.jwt;
		} catch {
			// נרשם בין-לבין דרך אתר אחר? ננסה שוב issue-jwt.
			jwt = await issueSsoJwt(emailLc);
		}
	}
	if (!jwt) return null;
	const me = await getStrapiMe(jwt);
	if (!me?.email) return null;
	return {
		jwt,
		user: { id: String(me.id), name: displayName(me) || name, email: me.email }
	};
}

// ── Businesses (idx-business) ────────────────────────────────

const OWNER_EMAIL = 'yahavanter@gmail.com';

/**
 * סופר-אדמין — בעל האתר או app_role=super_admin. בנוסף לכל סמכויות האדמין,
 * רשאי גם למחוק רשומות לצמיתות (עסקים, פרסומות, ביקורות, דיווחים).
 * @param {any} me
 */
const isSuperAdmin = (me) => {
	const email = String(me?.email ?? '')
		.trim()
		.toLowerCase();
	return email === OWNER_EMAIL || me?.app_role === 'super_admin';
};
export { isSuperAdmin };

/**
 * אדמין (או סופר-אדמין) — רשאי לאשר/לדחות/להקפיא עסקים ופרסומות ולערוך כרטיסיות.
 * @param {any} me
 */
const isPrivileged = (me) => {
	if (isSuperAdmin(me)) return true;
	return ['idx_admin', 'ch_admin'].includes(me?.app_role);
};
export { isPrivileged };

// ── ניהול אדמינים (users-permissions, רשימת המשתמשים המשותפת) ──
// מינוי אדמין = קביעת app_role על המשתמש. התפקידים המוכרים:
//   super_admin — כל האתרים; idx_admin — האינדקס; ch_admin — הקהילה (מכובד גם כאן).
export const ADMIN_ROLES = ['super_admin', 'idx_admin', 'ch_admin'];

// אובייקט המשתמש המלא מכיל שדות רגישים (שאלות אבטחה, totp_secret) —
// לעולם לא מחזירים אותו ללקוח; ממפים לצורה רזה בלבד.
/** @param {any} u */
const toSlimUser = (u) => ({
	id: u.id,
	name: displayName(u),
	email: u.email || '',
	app_role: u.app_role || 'user',
	created_at: u.createdAt || '',
	registered_site: u.registered_site || ''
});

/** כל המשתמשים בעלי תפקיד ניהולי. @returns {Promise<any[]>} */
export async function listAdminUsers() {
	const qs =
		ADMIN_ROLES.map((r, i) => `filters[app_role][$in][${i}]=${r}`).join('&') +
		'&pagination[pageSize]=200&sort=id:asc';
	const arr = await apiJson(`/api/users?${qs}`);
	return (Array.isArray(arr) ? arr : []).map(toSlimUser);
}

/** חיפוש משתמשים למינוי — לפי אימייל / שם משתמש / כינוי. @param {string} q */
export async function searchUsers(q) {
	const enc = encodeURIComponent(q);
	const qs =
		`filters[$or][0][email][$containsi]=${enc}` +
		`&filters[$or][1][username][$containsi]=${enc}` +
		`&filters[$or][2][nickname][$containsi]=${enc}` +
		'&pagination[pageSize]=20&sort=id:desc';
	const arr = await apiJson(`/api/users?${qs}`);
	return (Array.isArray(arr) ? arr : []).map(toSlimUser);
}

/** משתמש בודד (רזה) לבדיקות הגנה לפני שינוי תפקיד. @param {string|number} userId */
export async function getUserSlim(userId) {
	const res = await api(`/api/users/${encodeURIComponent(String(userId))}`);
	if (!res.ok) return null;
	const u = await res.json().catch(() => null);
	return u?.id ? toSlimUser(u) : null;
}

/**
 * קביעת app_role למשתמש. users-permissions מצפה לגוף שטוח (בלי עטיפת data).
 * @param {string|number} userId @param {string} role
 */
export async function setUserRole(userId, role) {
	return apiJson(`/api/users/${encodeURIComponent(String(userId))}`, {
		method: 'PUT',
		body: JSON.stringify({ app_role: role })
	});
}

const BIZ_POPULATE = 'populate[logo]=true&populate[banners]=true';

/** כל העסקים המאושרים, ממוינים מהחדש לישן. @returns {Promise<any[]>} */
export async function listApprovedBusinesses() {
	const qs = `filters[status][$eq]=approved&${BIZ_POPULATE}&sort=createdAt:desc&pagination[pageSize]=1000`;
	const data = await apiJson(`/api/idx-businesses?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

/** עסק בודד לפי documentId (רק אם approved). @param {string} documentId */
export async function getBusiness(documentId) {
	const qs = BIZ_POPULATE;
	const res = await api(`/api/idx-businesses/${encodeURIComponent(documentId)}?${qs}`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	const b = data?.data;
	return b && b.status === 'approved' ? b : null;
}

/** יצירת עסק (status=pending נכפה ב-controller). @param {Record<string,any>} data */
export async function createBusiness(data) {
	return apiJson('/api/idx-businesses', { method: 'POST', body: JSON.stringify({ data }) });
}

/** מונה חשיפת-טלפון אטומי; מחזיר את הטלפון. @param {string} documentId */
export async function revealPhone(documentId) {
	const res = await api(`/api/idx-businesses/${encodeURIComponent(documentId)}/reveal-phone`, {
		method: 'POST'
	});
	if (!res.ok) return { ok: false, phone: '' };
	return res.json();
}

/** מונה צפיות אטומי. @param {string} documentId */
export async function trackView(documentId) {
	await api(`/api/idx-businesses/${encodeURIComponent(documentId)}/view`, { method: 'POST' }).catch(
		() => {}
	);
}

// ── Reviews (idx-review) ─────────────────────────────────────

/** ביקורות מאושרות לעסק (לפי documentId של העסק). @param {string} businessDocId */
export async function listReviews(businessDocId) {
	const qs =
		`filters[status][$eq]=approved&filters[business][documentId][$eq]=${encodeURIComponent(businessDocId)}` +
		`&sort=submitted_at:desc&pagination[pageSize]=200`;
	const data = await apiJson(`/api/idx-reviews?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

/** יצירת ביקורת (status=pending נכפה ב-controller). @param {Record<string,any>} data @param {string} [jwt] */
export async function createReview(data, jwt) {
	return apiJson('/api/idx-reviews', {
		method: 'POST',
		body: JSON.stringify({ data }),
		token: jwt // אם מחובר — לזהות בעלים; אחרת token השרת
	});
}

// ── Reports (idx-report) ─────────────────────────────────────

/** דיווח על עסק המפר את מדיניות הקהילה (token-only, לא ציבורי). @param {Record<string,any>} data */
export async function createReport(data) {
	return apiJson('/api/idx-reports', { method: 'POST', body: JSON.stringify({ data }) });
}

// ── Upload ───────────────────────────────────────────────────

/** העלאת תמונה ל-Strapi media; מחזיר id או null. @param {File} file */
export async function uploadImage(file) {
	const fd = new FormData();
	fd.append('files', file, file.name);
	const res = await api('/api/upload', { method: 'POST', body: fd });
	if (!res.ok) return null;
	const arr = await res.json().catch(() => null);
	return Array.isArray(arr) && arr[0]?.id ? arr[0].id : null;
}

// ── Moderation (מסך /admin) ──────────────────────────────────
// כל הקריאות server-side עם STRAPI_TOKEN (trusted) — רואות pending ורשאיות לשנות status.

/** עסקים שממתינים לאישור. @returns {Promise<any[]>} */
export async function listPendingBusinesses() {
	const qs = `filters[status][$eq]=pending&${BIZ_POPULATE}&sort=createdAt:desc&pagination[pageSize]=200`;
	const data = await apiJson(`/api/idx-businesses?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

/** ביקורות שממתינות לאישור (עם העסק המקושר). @returns {Promise<any[]>} */
export async function listPendingReviews() {
	const qs =
		'filters[status][$eq]=pending&populate[business][fields][0]=name&populate[business][fields][1]=documentId' +
		'&sort=createdAt:desc&pagination[pageSize]=200';
	const data = await apiJson(`/api/idx-reviews?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

/** דיווחים פתוחים (pending/reviewing). @returns {Promise<any[]>} */
export async function listOpenReports() {
	const qs =
		'filters[status][$in][0]=pending&filters[status][$in][1]=reviewing&sort=createdAt:desc&pagination[pageSize]=200';
	const data = await apiJson(`/api/idx-reports?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

const COLLECTION = /** @type {const} */ ({
	business: 'idx-businesses',
	review: 'idx-reviews',
	report: 'idx-reports'
});

/**
 * שינוי status של פריט מודרציה. @param {'business'|'review'|'report'} kind
 * @param {string} documentId @param {string} status
 */
export async function setStatus(kind, documentId, status) {
	const path = COLLECTION[kind];
	if (!path) throw new Error(`kind לא ידוע: ${kind}`);
	return apiJson(`/api/${path}/${encodeURIComponent(documentId)}`, {
		method: 'PUT',
		body: JSON.stringify({ data: { status } })
	});
}

/**
 * מחיקה לצמיתות — סופר-אדמין בלבד (נאכף ב-actions של הפאנל).
 * @param {'business'|'review'|'report'} kind @param {string} documentId
 */
export async function deleteItem(kind, documentId) {
	const path = COLLECTION[kind];
	if (!path) throw new Error(`kind לא ידוע: ${kind}`);
	const res = await api(`/api/${path}/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
	if (!res.ok && res.status !== 204) {
		const text = await res.text().catch(() => '');
		throw new Error(`strapi DELETE ${path} → ${res.status} ${text.slice(0, 200)}`);
	}
}

// ── ניהול כרטיסיות (פאנל /admin) ─────────────────────────────

/** כל העסקים בכל סטטוס — לטאב "כרטיסיות". @returns {Promise<any[]>} */
export async function listAllBusinesses() {
	const qs = `${BIZ_POPULATE}&sort=createdAt:desc&pagination[pageSize]=1000`;
	const data = await apiJson(`/api/idx-businesses?${qs}`);
	return Array.isArray(data?.data) ? data.data : [];
}

/** עסק בודד בכל סטטוס (לעמוד העריכה בפאנל). @param {string} documentId */
export async function getBusinessAdmin(documentId) {
	const res = await api(`/api/idx-businesses/${encodeURIComponent(documentId)}?${BIZ_POPULATE}`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	return data?.data ?? null;
}

/** עדכון שדות עסק מפאנל הניהול. @param {string} documentId @param {Record<string,any>} data */
export async function updateBusiness(documentId, data) {
	return apiJson(`/api/idx-businesses/${encodeURIComponent(documentId)}`, {
		method: 'PUT',
		body: JSON.stringify({ data })
	});
}

// ── Ads — ראו src/lib/server/adsStore.js ─────────────────────
// ניהול הפרסומות (submitted-ads) פורט מהקהילה וחי בקובץ נפרד.

/**
 * חישוב-מחדש של דירוג העסק מהביקורות המאושרות שלו (best-effort). נקרא אחרי
 * אישור/דחיית ביקורת עם ה-documentId של העסק (שמסך המודרציה כבר מחזיק).
 * @param {string} bizDocId
 */
export async function recomputeBusinessRating(bizDocId) {
	if (!bizDocId) return;
	try {
		await api(`/api/idx-businesses/${encodeURIComponent(bizDocId)}/recompute-rating`, {
			method: 'POST'
		});
	} catch {
		/* best-effort — לא מפיל את פעולת המודרציה */
	}
}
