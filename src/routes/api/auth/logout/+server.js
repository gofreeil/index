import { json } from '@sveltejs/kit';
import { clearSession } from '$lib/server/session';

// ניתוק: מנקה את עוגיית ה-session (httpOnly).
export function POST({ cookies }) {
	clearSession(cookies);
	return json({ success: true });
}
