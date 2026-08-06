import { error, fail, redirect } from '@sveltejs/kit';
import {
	isPrivileged,
	isSuperAdmin,
	getBusinessAdmin,
	updateBusiness,
	deleteItem,
	assignBusinessOwner,
	releaseBusinessOwner,
	listUsersSlim
} from '$lib/server/strapi.js';
import { parseBusinessForm } from '$lib/server/businessEdit.js';
import { businessOwnerId, invalidateMatches } from '$lib/server/ownerMatch.js';
import { createClaim, decideClaim, invalidateClaims } from '$lib/server/claimsStore.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, locals }) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');
	const [biz, users] = await Promise.all([
		getBusinessAdmin(params.id),
		// רשימת המשתמשים לבורר הבעלות. כישלון שלה לא מפיל את מסך העריכה —
		// פשוט לא תוצג אפשרות לשייך ידנית.
		listUsersSlim().catch(() => [])
	]);
	if (!biz) throw error(404, 'העסק לא נמצא');
	return {
		biz,
		superAdmin: isSuperAdmin(locals.user),
		users: users
			.map((u) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone }))
			.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'he'))
	};
}

/** מאפס את המטמונים שנוגעים לבעלות — הבועה והרשימות מתעדכנות מיד. */
function refreshOwnershipCaches() {
	invalidateClaims();
	invalidateMatches();
	invalidatePendingCounts();
}

/** @type {import('./$types').Actions} */
export const actions = {
	save: async ({ request, params, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();

		// הרשומה הקיימת דרושה למיזוג extra_fields (Strapi מחליף json במלואו)
		const current = await getBusinessAdmin(params.id);
		if (!current) return fail(404, { error: 'העסק לא נמצא' });

		const { values, errors } = await parseBusinessForm(fd, { canModerate: true, current });
		if (Object.keys(errors).length) return fail(400, { errors });

		try {
			await updateBusiness(params.id, values);
		} catch (e) {
			return fail(502, {
				error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		// טלפון/אימייל/סטטוס שהשתנו משנים את תוצאות מנוע ההתאמה
		invalidateMatches();
		return { saved: true };
	},

	/**
	 * שיוך או העברת בעלות ידנית — אותו מנגנון של /admin/claims, אבל בלי
	 * לחכות לבקשה: האדמין בוחר משתמש והכרטיסייה עוברת אליו. נשמרת רשומת
	 * בקשה מאושרת כדי שתישאר עקבה בהיסטוריה של מי שייך את מי ומתי.
	 */
	assignOwner: async ({ request, params, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '').trim();
		if (!userId) return fail(400, { error: 'לא נבחר משתמש' });

		const [biz, users] = await Promise.all([
			getBusinessAdmin(params.id),
			listUsersSlim().catch(() => [])
		]);
		if (!biz) return fail(404, { error: 'העסק לא נמצא' });
		const target = users.find((u) => u.id === userId);
		if (!target) return fail(400, { error: 'המשתמש לא נמצא' });

		const from = businessOwnerId(biz);
		if (from === userId) return fail(400, { error: 'הכרטיסייה כבר משויכת למשתמש הזה' });

		try {
			await assignBusinessOwner(params.id, { id: userId, email: target.email });
		} catch (e) {
			return fail(502, {
				error: 'השיוך נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}

		const created = await createClaim({
			bizDocId: biz.documentId,
			bizName: biz.name || '',
			userId,
			userName: target.name,
			userEmail: target.email,
			userPhone: target.phone,
			matchedBy: 'manual',
			source: 'auto',
			reclaim: true,
			note: from ? `העברת בעלות יזומה של אדמין (ממשתמש #${from})` : 'שיוך יזום של אדמין'
		});
		if (created.ok) {
			await decideClaim(created.claim.id, 'approved', locals.user?.email ?? '').catch(() => {});
		}
		refreshOwnershipCaches();
		return {
			ownership: from
				? `הבעלות הועברה ממשתמש #${from} אל ${target.email}`
				: `הכרטיסייה שויכה ל-${target.email}`
		};
	},

	/**
	 * ניתוק בעלות — הכרטיסייה חוזרת להיות פנויה, חוזרת למנוע ההתאמה, וכל
	 * מי שיזוהה כבעליה יוכל לדרוש אותה מחדש.
	 */
	releaseOwner: async ({ params, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const biz = await getBusinessAdmin(params.id);
		if (!biz) return fail(404, { error: 'העסק לא נמצא' });
		if (!businessOwnerId(biz)) return fail(400, { error: 'לכרטיסייה אין בעלים' });
		try {
			await releaseBusinessOwner(params.id);
		} catch (e) {
			return fail(502, {
				error: 'הניתוק נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		refreshOwnershipCaches();
		return { ownership: 'הבעלות נותקה — הכרטיסייה פנויה לדרישה מחדש' };
	},

	del: async ({ params, locals }) => {
		if (!isSuperAdmin(locals.user)) {
			return fail(403, { error: 'מחיקה לצמיתות שמורה לסופר-אדמין' });
		}
		try {
			await deleteItem('business', params.id);
		} catch (e) {
			return fail(502, {
				error: 'המחיקה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		invalidateMatches();
		throw redirect(303, '/admin?tab=cards');
	}
};
