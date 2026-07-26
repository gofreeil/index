import { fail, redirect } from '@sveltejs/kit';
import {
	isSuperAdmin,
	listAdminUsers,
	searchUsers,
	getUserSlim,
	setUserRole
} from '$lib/server/strapi.js';

// מסך מינוי אדמינים — לסופר-אדמין בלבד. מינוי = קביעת app_role על המשתמש
// ברשימת המשתמשים המשותפת של Strapi (אותו מנגנון ש-hooks ו-isPrivileged קוראים).

// רק תפקידי האינדקס — לא מערבבים אדמינים של אתרים אחרים (ch_admin וכד')
const ASSIGNABLE = ['super_admin', 'idx_admin', 'user'];

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	if (!isSuperAdmin(locals.user)) throw redirect(302, '/admin');

	const q = (url.searchParams.get('q') || '').trim();
	const [admins, results] = await Promise.all([
		listAdminUsers().catch(() => []),
		q.length >= 2 ? searchUsers(q).catch(() => []) : Promise.resolve([])
	]);
	return { user: locals.user, admins, q, results };
}

/** @type {import('./$types').Actions} */
export const actions = {
	setRole: async ({ request, locals }) => {
		if (!isSuperAdmin(locals.user)) return fail(403, { error: 'פעולה זו לסופר-אדמין בלבד' });
		const fd = await request.formData();
		const userId = String(fd.get('userId') || '');
		const role = String(fd.get('role') || '');
		if (!userId || !ASSIGNABLE.includes(role)) return fail(400, { error: 'בקשה לא תקינה' });

		// הגנות: לא משנים את עצמך (נעילה-עצמית בטעות) ולא את בעל האתר.
		if (userId === String(locals.user?.id ?? '')) {
			return fail(400, { error: 'אי אפשר לשנות את התפקיד של עצמך' });
		}
		const target = await getUserSlim(userId);
		if (!target) return fail(404, { error: 'המשתמש לא נמצא' });
		if (target.email.trim().toLowerCase() === 'yahavanter@gmail.com') {
			return fail(400, { error: 'אי אפשר לשנות את בעל האתר' });
		}
		// app_role הוא שדה אחד — מינוי כאן היה דורס תפקיד של אתר אחר (למשל
		// ch_admin של חכמי העדה). תפקידים זרים מנהלים רק מהאתר שלהם.
		if (!ASSIGNABLE.includes(target.app_role)) {
			return fail(400, {
				error: `למשתמש יש תפקיד באתר אחר (${target.app_role}) — יש לנהל אותו מהאתר שלו`
			});
		}

		try {
			await setUserRole(userId, role);
		} catch (e) {
			return fail(502, {
				error: 'עדכון התפקיד נכשל: ' + (e instanceof Error ? e.message.slice(0, 160) : '')
			});
		}
		const labels = /** @type {Record<string,string>} */ ({
			super_admin: 'מונה לסופר-אדמין',
			idx_admin: 'מונה לאדמין האינדקס',
			user: 'הוסר מתפקיד ניהולי'
		});
		return { success: true, message: `${target.name || target.email} — ${labels[role]}` };
	}
};
