import { json } from '@sveltejs/kit';
import { strapiLogin, displayName } from '$lib/server/strapi';
import { setSession } from '$lib/server/session';

// התחברות מול ה-Strapi המשותף של יוצאים לחירות (רשימת המשתמשים המאוחדת).
// ה-JWT נשמר ב-cookie httpOnly (לא מוחזר ללקוח / לא ב-localStorage).
export async function POST({ request, cookies }) {
	try {
		const { email, password } = await request.json();
		if (!email || !password) {
			return json({ success: false, error: 'חסר אימייל או סיסמה' }, { status: 400 });
		}

		const identifier = String(email).trim().toLowerCase();
		const { jwt, user } = await strapiLogin(identifier, password);
		if (jwt) setSession(cookies, jwt);

		return json({
			success: true,
			user: { id: String(user.id), name: displayName(user) || user.name || '', email: user.email }
		});
	} catch (error) {
		return json({ success: false, error: 'אימייל או סיסמה שגויים' }, { status: 401 });
	}
}
