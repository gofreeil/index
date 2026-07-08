import { json } from '@sveltejs/kit';
import { strapiLogin } from '$lib/server/strapi';

// התחברות מול ה-Strapi המשותף של יוצאים לחירות (רשימת המשתמשים המאוחדת).
export async function POST({ request }) {
	try {
		const { email, password } = await request.json();
		if (!email || !password) {
			return json({ success: false, error: 'חסר אימייל או סיסמה' }, { status: 400 });
		}

		const identifier = String(email).trim().toLowerCase();
		const { user } = await strapiLogin(identifier, password);

		return json({
			success: true,
			user: { id: String(user.id), name: user.username || user.name || '', email: user.email }
		});
	} catch (error) {
		return json({ success: false, error: 'אימייל או סיסמה שגויים' }, { status: 401 });
	}
}
