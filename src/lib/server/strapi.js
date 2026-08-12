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
 * לכל אתר אדמין משלו: כאן מכובד רק idx_admin (אדמיני אתרים אחרים, כמו ch_admin
 * של חכמי העדה, לא מקבלים גישה).
 * @param {any} me
 */
const isPrivileged = (me) => {
	if (isSuperAdmin(me)) return true;
	return me?.app_role === 'idx_admin';
};
export { isPrivileged };

// ── ניהול אדמינים (users-permissions, רשימת המשתמשים המשותפת) ──
// מינוי אדמין = קביעת app_role על המשתמש. לכל אתר אדמין משלו — כאן מנהלים
// רק את אדמיני האינדקס (idx_admin) והסופר-אדמינים; תפקידים של אתרים אחרים
// (למשל ch_admin של חכמי העדה) לא מוצגים ולא ניתנים למינוי מכאן.
export const ADMIN_ROLES = ['super_admin', 'idx_admin'];

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

/**
 * הטלפון בפרופיל המשתמש — המפתח שבו המערכת מזהה כרטיסייה ותיקה כשייכת
 * למשתמש (ראו ownerMatch.js). לא נחשף ללקוח (רק תוצאת ההתאמה).
 * @param {string|number} userId @returns {Promise<string>}
 */
export async function getUserPhone(userId) {
	try {
		const res = await api(`/api/users/${encodeURIComponent(String(userId))}?fields[0]=phone`);
		if (!res.ok) return '';
		const u = await res.json().catch(() => null);
		return String(u?.phone ?? '');
	} catch {
		return '';
	}
}

/**
 * עדכון הטלפון בפרופיל המשתמש. נקרא רק מהאזור האישי ורק על המשתמש
 * המחובר עצמו — הטלפון הוא נתון מוצהר (אין אימות SMS), ולכן הוא משמש
 * להצעת התאמה בלבד; הבעלות עצמה ניתנת רק באישור אדמין.
 * @param {string|number} userId @param {string} phone
 */
export async function setUserPhone(userId, phone) {
	return apiJson(`/api/users/${encodeURIComponent(String(userId))}`, {
		method: 'PUT',
		body: JSON.stringify({ phone })
	});
}

/**
 * כל המשתמשים הרשומים, בצורה רזה — למנוע ההתאמה בלבד. הרשימה משותפת
 * לכל אתרי הרשת והיא קטנה (מאות בודדות), ולכן נשלפת בשלמותה ומותאמת
 * בזיכרון; כך אין קריאת רשת לכל כרטיסייה בנפרד.
 * @returns {Promise<{id:string,email:string,phone:string,name:string}[]>}
 */
export async function listUsersSlim() {
	/** @type {{id:string,email:string,phone:string,name:string}[]} */
	const out = [];
	for (let page = 1; page <= 10; page++) {
		const qs =
			'fields[0]=email&fields[1]=phone&fields[2]=username&fields[3]=nickname' +
			`&pagination[pageSize]=100&pagination[page]=${page}&sort=id:asc`;
		const arr = await apiJson(`/api/users?${qs}`);
		const rows = Array.isArray(arr) ? arr : [];
		out.push(
			...rows.map((u) => ({
				id: String(u.id),
				email: String(u.email ?? ''),
				phone: String(u.phone ?? ''),
				name: displayName(u)
			}))
		);
		if (rows.length < 100) break;
	}
	return out;
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

/**
 * עסק בודד לפי documentId (רק אם approved). ה-relation user נשלף (id בלבד)
 * כדי שדף העסק יידע מי הבעלים — מי רשאי לערוך ומי יכול לדרוש בעלות.
 * הוא אינו נחשף ללקוח: toBusiness לא ממפה אותו.
 * @param {string} documentId
 */
export async function getBusiness(documentId) {
	const qs = `${BIZ_POPULATE}&populate[user][fields][0]=id`;
	const res = await api(`/api/idx-businesses/${encodeURIComponent(documentId)}?${qs}`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	const b = data?.data;
	return b && b.status === 'approved' ? b : null;
}

/**
 * העסקים ששויכו למשתמש מסוים, בכל סטטוס — לאזור האישי. השיוך נשמר בשני
 * מפתחות (relation user + user_id), ולכן מחפשים בשניהם וממזגים.
 *
 * כאן *רק* בעלות אמיתית: כרטיסייה שרק מתאימה לטלפון של המשתמש אינה שלו
 * עדיין (הטלפון בפרופיל הוא נתון מוצהר שהמשתמש עצמו עורך). התאמות כאלה
 * מוצעות לו כ"בקשת בעלות" — ראו ownerMatch.js ו-claimsStore.js.
 * כל שאילתה נכשלת בנפרד ולא מפילה את השאר.
 * @param {{id?: string|number}} owner
 * @returns {Promise<any[]>}
 */
export async function listBusinessesByOwner({ id }) {
	if (!id) return [];
	const tail = `&${BIZ_POPULATE}&sort=createdAt:desc&pagination[pageSize]=100`;
	const enc = encodeURIComponent(String(id));
	const queries = [`filters[user][id][$eq]=${enc}${tail}`, `filters[user_id][$eq]=${enc}${tail}`];

	const results = await Promise.all(
		queries.map((qs) => apiJson(`/api/idx-businesses?${qs}`).catch(() => null))
	);
	/** @type {Map<string, any>} */
	const byDoc = new Map();
	for (const r of results) {
		for (const b of Array.isArray(r?.data) ? r.data : []) {
			if (b?.documentId) byDoc.set(b.documentId, b);
		}
	}
	return [...byDoc.values()].sort((a, b) =>
		String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
	);
}

/**
 * כל הכרטיסיות עם השדות הדרושים למנוע ההתאמה בלבד (טלפון, אימייל הבעלים
 * שב-extra_fields, ומי הבעלים אם יש). בלי מדיה ובלי תיאורים.
 * @returns {Promise<any[]>}
 */
export async function listBusinessesForMatch() {
	const fields = ['name', 'phone', 'city', 'category', 'status', 'extra_fields', 'user_id']
		.map((f, i) => `fields[${i}]=${f}`)
		.join('&');
	const data = await apiJson(
		`/api/idx-businesses?${fields}&populate[user][fields][0]=id&pagination[pageSize]=1000`
	);
	return Array.isArray(data?.data) ? data.data : [];
}

/**
 * שיוך כרטיסייה לבעלים (אחרי אישור בקשת בעלות). נכתב בשני המפתחות —
 * relation user וגם user_id — כי שניהם משמשים לזיהוי הבעלים, וגם
 * האימייל נשמר ב-extra_fields כדי שהזיהוי יעבוד גם בלי הטלפון.
 * ה-extra_fields ממוזג ולא נדרס: Strapi מחליף עמודת json במלואה.
 * @param {string} documentId @param {{id: string|number, email?: string}} owner
 */
export async function assignBusinessOwner(documentId, owner) {
	const current = await getBusinessAdmin(documentId);
	const extra =
		current?.extra_fields && typeof current.extra_fields === 'object'
			? { ...current.extra_fields }
			: {};
	const email = String(owner.email ?? '')
		.trim()
		.toLowerCase();
	if (email) extra.owner_email = email;
	const numericId = Number(owner.id);
	return updateBusiness(documentId, {
		user: Number.isFinite(numericId) ? numericId : owner.id,
		user_id: String(owner.id),
		extra_fields: extra
	});
}

/**
 * ניתוק בעלות מכרטיסייה — היא חוזרת להיות "בלי בעלים", אפשר לדרוש אותה
 * מחדש, והבעלים הקודם מאבד את זכות העריכה. שני מפתחות הבעלות מתאפסים.
 *
 * owner_email *לא* נמחק: אותה עמודה משמשת גם כאימייל הקשר של העסק (טופס
 * ההגשה והעריכה כותבים אליה), ומחיקתה הייתה מוחקת נתון של הכרטיסייה.
 * התוצאה גם רצויה — הכרטיסייה חוזרת להיות "מועמדת להתאמה" כמו כל כרטיסייה
 * שהוזרמה בייבוא.
 * @param {string} documentId
 */
export async function releaseBusinessOwner(documentId) {
	return updateBusiness(documentId, { user: null, user_id: null });
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

/**
 * הביקורת שהמשתמש כבר כתב על העסק, בכל סטטוס — כולל pending ו-rejected.
 * מכאן שאדם לא יכול להגיש שוב בזמן שהראשונה ממתינה לאישור, ולא יכול לנסות
 * שוב אחרי דחייה. השאילתה על user_id (מחרוזת) ולא על ה-relation, כי זה השדה
 * שה-controller ממלא מ-ctx.state.user.
 *
 * הערה: user_id מתמלא רק כשהבקשה יוצאת עם ה-JWT של המשתמש, כלומר רק אחרי
 * ש-'api::idx-review.idx-review.create' נוסף לתפקיד authenticated בבאקאנד
 * (community-backend/src/index.ts). עד אז השדה ריק בכל השורות והבדיקה כאן
 * לא תתפוס דבר — היא לא שוברת כלום, פשוט עדיין לא חוסמת.
 * @param {string} businessDocId @param {string} userId @returns {Promise<any|null>}
 */
export async function findUserReview(businessDocId, userId) {
	if (!businessDocId || !userId) return null;
	const qs =
		`filters[business][documentId][$eq]=${encodeURIComponent(businessDocId)}` +
		`&filters[user_id][$eq]=${encodeURIComponent(userId)}` +
		`&fields[0]=status&pagination[pageSize]=1`;
	const data = await apiJson(`/api/idx-reviews?${qs}`);
	return Array.isArray(data?.data) && data.data.length ? data.data[0] : null;
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

/**
 * כמו uploadImage, אבל מחזיר גם כתובת מוחלטת — לתמונות שנשמרות כ-URL
 * ב-KV (תמונות הקטגוריות) ולא כקשר מדיה על רשומה.
 * @param {File} file
 * @returns {Promise<{ id: number, url: string } | null>}
 */
export async function uploadImageMeta(file) {
	const fd = new FormData();
	fd.append('files', file, file.name);
	const res = await api('/api/upload', { method: 'POST', body: fd });
	if (!res.ok) return null;
	const arr = await res.json().catch(() => null);
	const m = Array.isArray(arr) ? arr[0] : null;
	if (!m?.id || !m?.url) return null;
	const url = String(m.url);
	return { id: m.id, url: url.startsWith('http') ? url : STRAPI_URL + url };
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

/**
 * ספירה בלבד — שולף שורה אחת וקורא את meta.pagination.total. משמש את בועת
 * ההתראה שרצה בכל טעינת עמוד אצל אדמין; שליפת הרשימות המלאות שם הייתה בזבוז.
 * @param {string} collection @param {string} filters @returns {Promise<number>}
 */
async function countBy(collection, filters) {
	try {
		const data = await apiJson(`/api/${collection}?${filters}&pagination[pageSize]=1`);
		return Number(data?.meta?.pagination?.total) || 0;
	} catch {
		return 0;
	}
}

/** כמה עסקים ממתינים לאישור. @returns {Promise<number>} */
export const countPendingBusinesses = () =>
	countBy('idx-businesses', 'filters[status][$eq]=pending');

/** כמה ביקורות ממתינות לאישור. @returns {Promise<number>} */
export const countPendingReviews = () => countBy('idx-reviews', 'filters[status][$eq]=pending');

/** כמה דיווחים פתוחים (pending/reviewing). @returns {Promise<number>} */
export const countOpenReports = () =>
	countBy('idx-reports', 'filters[status][$in][0]=pending&filters[status][$in][1]=reviewing');

/** כמה כרטיסיות יש במאגר בסך הכל. @returns {Promise<number>} */
export const countAllBusinesses = () => countBy('idx-businesses', '');

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

/**
 * כל הכרטיסיות עם השדות הדרושים לסטטיסטיקה בלבד (בלי לוגו/באנרים/תיאורים) —
 * מסך /admin/stats שולף 92 רשומות, ואין סיבה לגרור איתן מדיה.
 * @returns {Promise<any[]>}
 */
export async function listBusinessesForStats() {
	const fields = [
		'name',
		'category',
		'subcategory',
		'city',
		'status',
		'discount',
		'view_count',
		'phone_reveal_count',
		'rating_avg',
		'rating_count',
		'createdAt'
	]
		.map((f, i) => `fields[${i}]=${f}`)
		.join('&');
	const data = await apiJson(`/api/idx-businesses?${fields}&pagination[pageSize]=1000`);
	return Array.isArray(data?.data) ? data.data : [];
}

/**
 * הביקורות עם השדות הדרושים לסטטיסטיקה (דירוג, סטטוס, תאריך).
 * @returns {Promise<any[]>}
 */
export async function listReviewsForStats() {
	const qs =
		'fields[0]=rating&fields[1]=status&fields[2]=submitted_at' +
		'&populate[business][fields][0]=name&sort=createdAt:desc&pagination[pageSize]=500';
	const data = await apiJson(`/api/idx-reviews?${qs}`);
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
