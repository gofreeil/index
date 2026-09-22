// ============================================================
// adminNotify.js — הודעות לתיבת ההודעות של האדמינים.
//
// ערוץ ההתראות היחיד שיש: אוסף messages ב-Strapi המשותף, שנקרא
// בתיבת ההודעות באתר קהילה בשכונה. כל מה שנכנס לתור אישורים כאן
// (פרסומת חדשה, בקשת בעלות) צריך לשלוח הודעה — אחרת הבקשה יושבת
// בפאנל ואיש לא יודע עליה עד שנכנסים במקרה.
//
// נמענים: בעל האתר (ADS_NOTIFY_EMAIL) וכל אדמין ממונה
// (super_admin / idx_admin) — כל מי שמוסמך להכריע בבקשה.
// כשל בשליחה לעולם לא מפיל את הפעולה שיצרה אותה.
// ============================================================

import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';

export const SITE_NAME = 'מדריך בעלי מקצוע כשירים';

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	/** @type {Record<string, string>} */
	const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/** מזהה המשתמש (Strapi) של הבעלים — לפי ADS_NOTIFY_EMAIL. */
export async function resolveOwnerUserId() {
	const email = (env.ADS_NOTIFY_EMAIL ?? '').trim().toLowerCase();
	if (!email) return null;
	try {
		const res = await api(`/api/users?filters[email][$eq]=${encodeURIComponent(email)}`);
		if (!res.ok) return null;
		// users-permissions מחזיר מערך שטוח (לא { data })
		const users = await res.json();
		return Array.isArray(users) ? (users[0]?.id ?? null) : null;
	} catch {
		return null;
	}
}

/** מזהי כל נמעני ההתראות: הבעלים וגם כל אדמין שמונה (super_admin / idx_admin).
 *  התראה על בקשה שממתינה לאישור צריכה להגיע לכל מי שמוסמך לאשר אותה, לא רק
 *  לאדם אחד.
 *  @returns {Promise<number[]>} */
export async function resolveAdminUserIds() {
	/** @type {Set<number>} */
	const ids = new Set();
	const owner = await resolveOwnerUserId();
	if (owner) ids.add(owner);
	try {
		const qs = ['super_admin', 'idx_admin']
			.map((r, i) => `filters[app_role][$in][${i}]=${encodeURIComponent(r)}`)
			.join('&');
		const res = await api(`/api/users?${qs}&pagination[limit]=100`);
		if (res.ok) {
			const users = await res.json();
			if (Array.isArray(users)) {
				for (const u of users) if (u?.id) ids.add(u.id);
			}
		}
	} catch {
		/* בלי רשימת אדמינים נסתפק בבעלים */
	}
	return [...ids];
}

/** שולח הודעה אחת לכל נמען. @param {number[]} receivers @param {string} content */
export async function sendMessages(receivers, content) {
	await Promise.all(
		receivers.map((receiver) =>
			api('/api/messages', {
				method: 'POST',
				body: JSON.stringify({ data: { receiver, content, read: false } })
			})
		)
	);
}

/** הודעה לכל האדמינים. נכשלת בשקט. @param {string} content @param {string} [label] */
export async function notifyAdmins(content, label = 'notify') {
	try {
		const receivers = await resolveAdminUserIds();
		if (receivers.length === 0) {
			console.warn(`adminNotify: no recipient resolved — skipping ${label}`);
			return;
		}
		await sendMessages(receivers, content);
	} catch (err) {
		console.warn(`adminNotify: ${label} failed`, err instanceof Error ? err.message : err);
	}
}
