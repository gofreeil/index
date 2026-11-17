// ============================================================
// calendarNotesStore.js — הערות היומן באזור האישי, לפי משתמש.
// אותו דפוס אחסון כמו shareLogStore: פריט אחד לכל משתמש באוסף ה-items,
// תחת קטגוריה פנימית (__idx_calnotes). רק המשתמש עצמו קורא וכותב.
// ============================================================

import { env } from '$env/dynamic/private';
import { mergeNotes } from '$lib/calendarNotes.js';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = env.STRAPI_TOKEN || '';
const ENDPOINT = '/api/items';
const CATEGORY = '__idx_calnotes';

/** @param {string|number} userId */
const labelOf = (userId) => `idx-calnotes:${userId}`;

/** @param {string} path @param {any} [init] */
async function api(path, init = {}) {
	const headers = /** @type {Record<string,string>} */ ({ ...(init.headers || {}) });
	if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
	if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
	return fetch(`${STRAPI_URL}${path}`, { ...init, headers });
}

/** @param {string|number} userId */
async function loadItem(userId) {
	const qs =
		`filters[category][$eq]=${CATEGORY}` +
		`&filters[label][$eq]=${encodeURIComponent(labelOf(userId))}` +
		`&pagination[pageSize]=1`;
	const res = await api(`${ENDPOINT}?${qs}`);
	if (!res.ok) throw new Error(`calendar-notes GET → ${res.status}`);
	const data = await res.json().catch(() => null);
	const item = Array.isArray(data?.data) ? data.data[0] : null;
	return {
		id: /** @type {string|null} */ (item?.documentId ?? null),
		notes: mergeNotes(item?.extra_fields?.notes)
	};
}

/** @param {string|number} userId @param {string|null} id @param {any[]} notes */
async function saveItem(userId, id, notes) {
	const extra_fields = { notes };
	if (id) {
		const res = await api(`${ENDPOINT}/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: JSON.stringify({ data: { extra_fields } })
		});
		if (!res.ok) throw new Error(`calendar-notes PUT → ${res.status}`);
		return;
	}
	const res = await api(ENDPOINT, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				label: labelOf(userId),
				category: CATEGORY,
				description: '[SYSTEM] הערות יומן של האזור האישי — מדריך בעלי המקצוע',
				icon: '📅',
				extra_fields,
				status1: 'active',
				publishedAt: new Date().toISOString()
			}
		})
	});
	if (!res.ok) throw new Error(`calendar-notes POST → ${res.status}`);
}

/** @param {string|number} userId */
export async function getCalendarNotes(userId) {
	return (await loadItem(userId)).notes;
}

/** @param {string|number} userId @param {any[]} incoming */
export async function mergeCalendarNotes(userId, incoming) {
	const cur = await loadItem(userId);
	const notes = mergeNotes(cur.notes, incoming);
	if (JSON.stringify(notes) !== JSON.stringify(cur.notes)) await saveItem(userId, cur.id, notes);
	return notes;
}
