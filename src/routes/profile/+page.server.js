import { redirect } from '@sveltejs/kit';
import { isPrivileged } from '$lib/server/strapi.js';

// האזור האישי — רק למחוברים. מקור-האמת הוא ה-session (locals.user מ-hooks).
export function load({ locals }) {
	if (!locals.user) throw redirect(302, '/auth/login');
	// isAdmin מחושב בשרת (isPrivileged) — הלקוח רק מציג/מסתיר קיצור; ההרשאה נאכפת ב-/admin עצמו.
	return { user: locals.user, isAdmin: isPrivileged(locals.user) };
}
