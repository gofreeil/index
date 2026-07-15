import { redirect } from '@sveltejs/kit';

// האזור האישי — רק למחוברים. מקור-האמת הוא ה-session (locals.user מ-hooks).
export function load({ locals }) {
	if (!locals.user) throw redirect(302, '/auth/login');
	return { user: locals.user };
}
