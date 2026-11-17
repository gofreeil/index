import { json } from '@sveltejs/kit';
import { getCalendarNotes, mergeCalendarNotes } from '$lib/server/calendarNotesStore.js';

// הערות היומן של המשתמש המחובר — ורק שלו (המזהה תמיד מה-session).

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/calendar-notes → { notes } */
export async function GET({ locals }) {
	const userId = /** @type {any} */ (locals).user?.id;
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	try {
		return json({ notes: await getCalendarNotes(userId) }, { headers: NO_STORE });
	} catch (e) {
		console.error('[calendar-notes] GET failed:', e instanceof Error ? e.message : e);
		return json({ error: 'unavailable' }, { status: 502 });
	}
}

/** POST /api/calendar-notes { notes: CalNote[] } → { notes } (מיזוג) */
export async function POST({ locals, request }) {
	const userId = /** @type {any} */ (locals).user?.id;
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!Array.isArray(body?.notes)) return json({ error: 'bad request' }, { status: 400 });
	try {
		const notes = await mergeCalendarNotes(userId, body.notes.slice(0, 500));
		return json({ notes }, { headers: NO_STORE });
	} catch (e) {
		console.error('[calendar-notes] POST failed:', e instanceof Error ? e.message : e);
		return json({ error: 'unavailable' }, { status: 502 });
	}
}
