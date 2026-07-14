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
		user: { id: String(me.id), name: me.username || name || me.email, email: me.email }
	};
}

// ── Businesses (idx-business) ────────────────────────────────

/** @param {any} me */
const isPrivileged = (me) => {
	const email = String(me?.email ?? '').trim().toLowerCase();
	if (email === 'yahavanter@gmail.com') return true;
	return ['super_admin', 'idx_admin', 'ch_admin'].includes(me?.app_role);
};
export { isPrivileged };

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
