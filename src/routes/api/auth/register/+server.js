import { json } from '@sveltejs/kit';
import { strapiRegister } from '$lib/server/strapi';

// הרשמה מול ה-Strapi המשותף של יוצאים לחירות (רשימת המשתמשים המאוחדת).
export async function POST({ request }) {
	try {
		const { name, email, password } = await request.json();
		if (!email || !password) {
			return json({ success: false, error: 'חסר אימייל או סיסמה' }, { status: 400 });
		}

		const emailLc = String(email).trim().toLowerCase();
		const username = (name && String(name).trim()) || emailLc.split('@')[0];

		try {
			const { user } = await strapiRegister(username, emailLc, password);
			return json({
				success: true,
				user: { id: String(user.id), name: user.username || name || '', email: user.email }
			});
		} catch (err) {
			const msg = String(err?.message || '');
			// אימייל/שם משתמש כבר תפוס
			if (msg.includes('taken') || msg.includes('already') || msg.includes('409') || msg.includes('400')) {
				return json({ success: false, error: 'משתמש עם אימייל זה כבר קיים' }, { status: 400 });
			}
			throw err;
		}
	} catch (error) {
		return json({ success: false, error: 'ההרשמה נכשלה' }, { status: 500 });
	}
}
