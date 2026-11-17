import { json } from '@sveltejs/kit';
import { clearShareLogFor, getShareLog, mergeShareLog } from '$lib/server/shareLogStore.js';

// "למי שלחתי" של המשתמש המחובר — ורק שלו. המזהה נלקח תמיד מה-session
// (locals.user), לעולם לא מהבקשה: אין דרך לקרוא או לכתוב יומן של אחר.

/** @param {any} locals */
function me(locals) {
	const id = locals.user?.id;
	return id ? String(id) : '';
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/share-log → { userId, entries, clearedAt } */
export async function GET({ locals }) {
	const userId = me(locals);
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	try {
		return json({ userId, ...(await getShareLog(userId)) }, { headers: NO_STORE });
	} catch (e) {
		console.error('[share-log] GET failed:', e instanceof Error ? e.message : e);
		return json({ error: 'unavailable' }, { status: 502 });
	}
}

/**
 * POST /api/share-log { entries: ShareEntry[] } → { userId, entries, clearedAt }
 * מיזוג: שליחה חדשה, מתן שם לנמען, או העברת הרשימה הישנה מהדפדפן.
 */
export async function POST({ locals, request }) {
	const userId = me(locals);
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	const incoming = Array.isArray(body?.entries) ? body.entries.slice(0, 250) : null;
	if (!incoming) return json({ error: 'bad request' }, { status: 400 });
	try {
		return json({ userId, ...(await mergeShareLog(userId, incoming)) }, { headers: NO_STORE });
	} catch (e) {
		console.error('[share-log] POST failed:', e instanceof Error ? e.message : e);
		return json({ error: 'unavailable' }, { status: 502 });
	}
}

/** DELETE /api/share-log → { clearedAt } */
export async function DELETE({ locals }) {
	const userId = me(locals);
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	try {
		return json({ clearedAt: await clearShareLogFor(userId) }, { headers: NO_STORE });
	} catch (e) {
		console.error('[share-log] DELETE failed:', e instanceof Error ? e.message : e);
		return json({ error: 'unavailable' }, { status: 502 });
	}
}
