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
		// 400/401 מ-Strapi = פרטים שגויים; כל השאר = השרת לא ענה. המשתמש חייב
		// לדעת מה מהשניים — "סיסמה שגויה" על תקלת שרת שולח אותו לאפס סיסמה לחינם.
		const msg = error instanceof Error ? error.message : '';
		if (/→ 40[01] /.test(msg)) {
			return json(
				{
					success: false,
					error:
						'האימייל או הסיסמה לא נכונים. אם נרשמתם עם Google או דרך "יוצאים לחירות" — התחברו באותה דרך (הכפתורים למעלה).'
				},
				{ status: 401 }
			);
		}
		console.error('login failed:', msg);
		return json(
			{ success: false, error: 'שרת המשתמשים לא הגיב כרגע — נסו שוב בעוד דקה. הפרטים שלכם לא נפגעו.' },
			{ status: 503 }
		);
	}
}
