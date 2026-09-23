import { redirect } from '@sveltejs/kit';

/**
 * קיצור לקישור "הכרטיסייה שלך אושרה" שנשלח ב-SMS אחרי שיוך — מפנה ישר
 * לעריכת העסק. מי שלא מחובר עובר קודם בכניסה, שמחזירה אותו לעריכה.
 * @type {import('./$types').RequestHandler}
 */
export function GET({ params, locals }) {
	const edit = `/business/${encodeURIComponent(params.id)}/edit`;
	if (!locals.user) redirect(302, `/auth/login?returnTo=${encodeURIComponent(edit)}`);
	redirect(302, edit);
}
