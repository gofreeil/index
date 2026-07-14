import { json } from '@sveltejs/kit';
import { OAuth2Client } from 'google-auth-library';
import * as publicVars from '$env/static/public';
import { strapiGoogleUpsert } from '$lib/server/strapi';
import { setSession } from '$lib/server/session';

const PUBLIC_GOOGLE_CLIENT_ID = publicVars['PUBLIC_GOOGLE_CLIENT_ID'] || '';
const client = new OAuth2Client(PUBLIC_GOOGLE_CLIENT_ID);

// התחברות Google → JWT אמיתי ב-Strapi המשותף (בלי סיסמה דטרמיניסטית).
// ה-ID token מאומת (חתימה + audience), ואז מונפק JWT דרך strapiGoogleUpsert
// (issue-jwt / הרשמה בסיסמה אקראית). ה-JWT נשמר ב-cookie httpOnly.
export async function POST({ request, cookies }) {
	try {
		const { credential } = await request.json();

		const ticket = await client.verifyIdToken({
			idToken: credential,
			audience: PUBLIC_GOOGLE_CLIENT_ID
		});
		const payload = ticket.getPayload();

		if (!payload || !payload.email) {
			return json({ success: false, error: 'טוקן Google לא תקין' }, { status: 400 });
		}

		const email = String(payload.email).trim().toLowerCase();
		const name = payload.name || email.split('@')[0];

		const result = await strapiGoogleUpsert(email, name);
		if (!result) {
			return json({ success: false, error: 'ההתחברות נכשלה' }, { status: 500 });
		}
		setSession(cookies, result.jwt);
		return json({ success: true, user: result.user });
	} catch (error) {
		console.error('Google Auth API Error:', error);
		return json({ success: false, error: 'ההתחברות נכשלה' }, { status: 500 });
	}
}
