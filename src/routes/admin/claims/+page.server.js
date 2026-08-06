import { fail, redirect } from '@sveltejs/kit';
import { assignBusinessOwner, getBusinessAdmin, isPrivileged } from '$lib/server/strapi.js';
import {
	createClaim,
	decideClaim,
	dismissMatch,
	invalidateClaims,
	listClaims,
	listPendingClaims
} from '$lib/server/claimsStore.js';
import {
	businessOwnerId,
	invalidateMatches,
	listAutoMatches,
	ownershipByDoc
} from '$lib/server/ownerMatch.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';

// כמה הכרעות אחרונות מוצגות בהיסטוריה
const HISTORY = 20;

/**
 * מסך הבעלות: מי דרש כרטיסייה, ואילו התאמות המערכת מצאה בין המשתמשים
 * הרשומים לכרטיסיות שאין להן בעלים. אישור כאן הוא הרגע שבו נכתב השיוך
 * על הרשומה — ומאותו רגע בעל העסק רשאי לערוך את הדף שלו.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ locals }) {
	if (!isPrivileged(locals.user)) throw redirect(302, '/admin');

	const [claims, matches, all] = await Promise.all([
		listPendingClaims().catch(() => []),
		listAutoMatches(),
		listClaims().catch(() => [])
	]);

	// בקשה על כרטיסייה שכבר יש לה בעלים אינה שיוך אלא *העברה* — האדמין
	// צריך לראות את זה לפני שהוא לוחץ, ולאשר בכפתור נפרד.
	const owners = await ownershipByDoc(claims.map((c) => c.bizDocId));

	return {
		claims: claims.map((c) => {
			const owner = owners.get(c.bizDocId);
			const ownerId = owner?.ownerId ?? '';
			return {
				...c,
				// ריק כשאין בעלים, או כשהבעלים הוא הדורש עצמו (בקשה שהתייתרה)
				currentOwnerId: ownerId && ownerId !== c.userId ? ownerId : '',
				currentOwnerEmail: ownerId && ownerId !== c.userId ? (owner?.ownerEmail ?? '') : '',
				alreadyOwner: !!ownerId && ownerId === c.userId
			};
		}),
		// התאמות שאיש עוד לא דרש — הבקשות עצמן כבר מופיעות ברשימה למעלה
		matches: matches.filter((m) => m.claim === 'none'),
		history: all
			.filter((c) => c.status !== 'pending')
			.sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)))
			.slice(0, HISTORY)
	};
}

/**
 * כותב את השיוך על הכרטיסייה. מאמת מחדש שאין לה כבר בעלים — שני אדמינים
 * שמאשרים במקביל לא יכולים לדרוס זה את זה בלי לשים לב. העברה מבעלים קיים
 * אפשרית, אבל רק בכוונה מפורשת (transfer) — כלומר בלחיצה על "העבר בעלות".
 * @param {string} bizDocId @param {string} userId @param {string} userEmail
 * @param {boolean} [transfer]
 * @returns {Promise<{ok: true, name: string, from: string} | {ok: false, error: string}>}
 */
async function writeOwner(bizDocId, userId, userEmail, transfer = false) {
	const biz = await getBusinessAdmin(bizDocId);
	if (!biz) return { ok: false, error: 'הכרטיסייה לא נמצאה' };
	const current = businessOwnerId(biz);
	if (current && current !== String(userId) && !transfer) {
		return {
			ok: false,
			error: `לכרטיסייה כבר יש בעלים (משתמש #${current}). להעברה יש להשתמש בכפתור "אשר והעבר בעלות".`
		};
	}
	try {
		await assignBusinessOwner(bizDocId, { id: userId, email: userEmail });
	} catch (e) {
		return {
			ok: false,
			error: 'השיוך נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
		};
	}
	return {
		ok: true,
		name: biz.name || '',
		from: current && current !== String(userId) ? current : ''
	};
}

/** מאפס את כל המטמונים שנוגעים לבעלות — הבועה והרשימות מתעדכנות מיד. */
function refreshCaches() {
	invalidateClaims();
	invalidateMatches();
	invalidatePendingCounts();
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * אישור בקשה: כותב את השיוך ואז מסמן את הבקשה כמאושרת. כשהכרטיסייה
	 * כבר משויכת למישהו אחר, האישור הוא העברת בעלות — והוא נדרש להגיע
	 * מהכפתור שמצהיר על כך (transfer=1).
	 */
	approve: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const claimId = String(fd.get('claimId') ?? '');
		const transfer = fd.get('transfer') === '1';
		const claim = (await listPendingClaims()).find((c) => c.id === claimId);
		if (!claim) return fail(404, { error: 'הבקשה לא נמצאה' });

		const written = await writeOwner(claim.bizDocId, claim.userId, claim.userEmail, transfer);
		if (!written.ok) return fail(502, { error: written.error });

		try {
			await decideClaim(claimId, 'approved', locals.user?.email ?? '');
		} catch (e) {
			// השיוך כבר נכתב — הכרטיסייה שייכת לו; רק סימון הבקשה נכשל
			return fail(502, {
				error: 'השיוך בוצע אך עדכון הבקשה נכשל: ' + (e instanceof Error ? e.message : '')
			});
		}
		refreshCaches();
		return {
			ok: true,
			message: written.from
				? `${claim.bizName || 'הכרטיסייה'} הועברה ממשתמש #${written.from} ל-${claim.userEmail}`
				: `${claim.bizName || 'הכרטיסייה'} שויכה ל-${claim.userEmail}`
		};
	},

	/** דחיית בקשה — הכרטיסייה נשארת בלי בעלים. */
	reject: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const claimId = String(fd.get('claimId') ?? '');
		try {
			const decided = await decideClaim(claimId, 'rejected', locals.user?.email ?? '');
			if (!decided) return fail(404, { error: 'הבקשה לא נמצאה' });
		} catch (e) {
			return fail(502, { error: 'העדכון נכשל: ' + (e instanceof Error ? e.message : '') });
		}
		refreshCaches();
		return { ok: true, message: 'הבקשה נדחתה' };
	},

	/**
	 * שיוך יזום מהתאמה שהמערכת מצאה — בלי לחכות שהמשתמש יבקש. נשמרת
	 * רשומת בקשה מאושרת, כדי שתישאר עקבות למי שייך את מי ומתי.
	 */
	assign: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('bizDocId') ?? '');
		const userId = String(fd.get('userId') ?? '');
		const userEmail = String(fd.get('userEmail') ?? '');
		const userName = String(fd.get('userName') ?? '');
		const matchedBy = fd.get('matchedBy') === 'email' ? 'email' : 'phone';
		if (!bizDocId || !userId) return fail(400, { error: 'בקשה לא תקינה' });

		const written = await writeOwner(bizDocId, userId, userEmail);
		if (!written.ok) return fail(502, { error: written.error });

		const created = await createClaim({
			bizDocId,
			bizName: written.name,
			userId,
			userName,
			userEmail,
			userPhone: String(fd.get('userPhone') ?? ''),
			matchedBy,
			source: 'auto',
			note: 'שיוך יזום של אדמין מתוך התאמה אוטומטית'
		});
		if (created.ok) {
			await decideClaim(created.claim.id, 'approved', locals.user?.email ?? '').catch(() => {});
		}
		refreshCaches();
		return { ok: true, message: `${written.name || 'הכרטיסייה'} שויכה ל-${userEmail}` };
	},

	/** "התעלם" — ההתאמה לא נכונה; לא תוצג שוב ולא תיספר בבועה. */
	dismiss: async ({ request, locals }) => {
		if (!isPrivileged(locals.user)) return fail(403, { error: 'אין הרשאה' });
		const fd = await request.formData();
		const bizDocId = String(fd.get('bizDocId') ?? '');
		const userId = String(fd.get('userId') ?? '');
		if (!bizDocId || !userId) return fail(400, { error: 'בקשה לא תקינה' });
		try {
			await dismissMatch({
				bizDocId,
				bizName: String(fd.get('bizName') ?? ''),
				userId,
				userEmail: String(fd.get('userEmail') ?? ''),
				decidedBy: locals.user?.email ?? ''
			});
		} catch (e) {
			return fail(502, { error: 'העדכון נכשל: ' + (e instanceof Error ? e.message : '') });
		}
		refreshCaches();
		return { ok: true, message: 'ההתאמה סומנה כלא רלוונטית' };
	}
};
