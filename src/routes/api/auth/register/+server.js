import { json } from '@sveltejs/kit';
import { strapiRegister, displayName } from '$lib/server/strapi';
import { setSession } from '$lib/server/session';

// הרשמה מול ה-Strapi המשותף של יוצאים לחירות (רשימת המשתמשים המאוחדת).
// ה-JWT נשמר ב-cookie httpOnly (לא מוחזר ללקוח / לא ב-localStorage).
export async function POST({ request, cookies }) {
	try {
		const { name, email, password } = await request.json();
		if (!email || !password) {
			return json({ success: false, error: 'חסר אימייל או סיסמה' }, { status: 400 });
		}

		const emailLc = String(email).trim().toLowerCase();
		const username = (name && String(name).trim()) || emailLc.split('@')[0];

		try {
			const { jwt, user } = await strapiRegister(username, emailLc, password);
			if (jwt) setSession(cookies, jwt);
			return json({
				success: true,
				user: { id: String(user.id), name: displayName(user) || name || '', email: user.email }
			});
		} catch (err) {
			const msg = String(/** @type {any} */ (err)?.message || '');
			// אימייל/שם משתמש כבר תפוס
			if (
				msg.includes('taken') ||
				msg.includes('already') ||
				msg.includes('409') ||
				msg.includes('400')
			) {
				return json({ success: false, error: 'משתמש עם אימייל זה כבר קיים' }, { status: 400 });
			}
			throw err;
		}
	} catch (error) {
		return json({ success: false, error: 'ההרשמה נכשלה' }, { status: 500 });
	}
}
