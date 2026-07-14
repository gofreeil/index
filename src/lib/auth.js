import { writable } from 'svelte/store';

// המשתמש המחובר. מקור-האמת הוא ה-session ב-cookie httpOnly (locals.user →
// data.user דרך +layout.server.js), לא localStorage. ה-store מאוכלס ב-root layout.
export const authUser = writable(/** @type {any} */ (null));

/** אכלוס מנתוני השרת (data.user). @param {any} user */
export function hydrateAuth(user) {
	authUser.set(user ?? null);
}

/** תאימות לאחור — מעדכן את ה-store בלבד (ה-session מנוהל ב-cookie). @param {any} user */
export function setAuthUser(user) {
	authUser.set(user ?? null);
}

/** ניתוק: מנקה את עוגיית ה-session בשרת ואז מרענן. */
export async function logout() {
	try {
		await fetch('/api/auth/logout', { method: 'POST' });
	} catch {
		/* ניקוי מקומי בכל מקרה */
	}
	authUser.set(null);
	if (typeof window !== 'undefined') window.location.href = '/';
}
