import { createHash } from 'crypto';

// ה-Strapi המשותף של יוצאים לחירות — אותה רשימת משתמשים מאוחדת לכל האתרים.
// (api.gofreeil.com == אותו שרת של community-il.duckdns.org)
export const STRAPI_URL = 'https://api.gofreeil.com';

/** סיסמה דטרמיניסטית למשתמשי Google (אין להם סיסמה ידנית) */
function googlePassword(googleId) {
	return createHash('sha256').update('gofreeil-index:' + googleId).digest('hex').slice(0, 32);
}

/**
 * לוגין מול ה-Strapi המשותף.
 * @param {string} identifier אימייל
 * @param {string} password
 * @returns {Promise<{jwt:string, user:any}>}
 */
export async function strapiLogin(identifier, password) {
	const res = await fetch(STRAPI_URL + '/api/auth/local', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier, password })
	});
	if (!res.ok) throw new Error('login failed');
	return res.json();
}

/**
 * הרשמה ל-Strapi המשותף.
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{jwt:string, user:any}>}
 */
export async function strapiRegister(username, email, password) {
	const res = await fetch(STRAPI_URL + '/api/auth/local/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, email, password })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error('register failed: ' + text);
	}
	return res.json();
}

/**
 * אימות JWT מול ה-Strapi המשותף (משמש את כניסת ה-SSO).
 * @param {string} jwt
 * @returns {Promise<any|null>}
 */
export async function getStrapiMe(jwt) {
	if (!jwt) return null;
	try {
		const res = await fetch(STRAPI_URL + '/api/users/me', {
			headers: { Authorization: `Bearer ${jwt}` }
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/**
 * לוגין-או-הרשמה למשתמש Google מול ה-Strapi המשותף (סיסמה דטרמיניסטית).
 * מחזיר את פרטי המשתמש להצגה. אם המשתמש כבר קיים דרך שיטת התחברות אחרת
 * (register נכשל) — עדיין מחזיר את הפרטים מפרטי גוגל, כי הוא נמצא ברשימה המאוחדת.
 * @param {string} email
 * @param {string} name
 * @param {string} googleId
 * @returns {Promise<{id:string, name:string, email:string}>}
 */
export async function strapiGoogleUpsert(email, name, googleId) {
	const password = googlePassword(googleId);
	const username = (email.split('@')[0] || googleId).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30) + '_' + googleId.slice(-4);
	try {
		const { user } = await strapiLogin(email, password);
		return { id: String(user.id), name: user.username || name, email: user.email };
	} catch {
		try {
			const { user } = await strapiRegister(username, email, password);
			return { id: String(user.id), name: name || user.username, email: user.email };
		} catch {
			// כבר קיים בשיטה אחרת — עדיין חבר ברשימה המאוחדת
			return { id: googleId, name, email };
		}
	}
}
