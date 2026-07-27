import { json, error } from '@sveltejs/kit';
import { isOwnerCode } from '$lib/server/adsCode.js';

// אימות קוד הבעלים בצד השרת — הקוד עצמו לא קיים בקוד הלקוח.
/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	/** @type {any} */
	let payload;
	try {
		payload = await request.json();
	} catch {
		throw error(400, 'גוף הבקשה חייב להיות JSON תקין');
	}
	return json({ ok: isOwnerCode(payload?.code) });
}
