import { error, fail } from '@sveltejs/kit';
import { getBusiness, getUserPhone, isPrivileged } from '$lib/server/strapi.js';
import { toBusiness } from '$lib/businessShape.js';
import { resolveCategory } from '$lib/categories.js';
import {
	businessOwnerId,
	canEditBusiness,
	isBusinessOwner,
	matchKind
} from '$lib/server/ownerMatch.js';
import { createClaim, findClaim } from '$lib/server/claimsStore.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';

/**
 * טעינת עסק בודד לפי documentId יציב (מחליף את array-index השביר). 404 אמיתי.
 *
 * הטלפון של המשתמש נשלף במקביל לעסק ולא אחריו — כדי שבדיקת הבעלות לא
 * תוסיף סבב רשת להשהיית הדף. מבקר אנונימי (וסורק) לא משלם עליה כלל.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ params, locals }) {
	const user = locals.user;
	const [b, userPhone] = await Promise.all([
		getBusiness(params.id),
		user ? getUserPhone(user.id) : Promise.resolve('')
	]);
	if (!b) throw error(404, 'העסק לא נמצא או ממתין לאישור');

	const admin = isPrivileged(user);
	const business = toBusiness(b);

	// בעלות = שיוך שנכתב על הרשומה, לא התאמת פרטים. רוב הכרטיסיות הוזרמו
	// בייבוא ואין להן בעלים — אותן אפשר "לדרוש", והאדמין מכריע.
	const owned = !!businessOwnerId(b);
	const claim = user ? await findClaim(business.documentId, user.id).catch(() => null) : null;

	return {
		// אותו סיווג בדיוק כמו בדף הבית — כרטיסייה שהאינדקס מציג תחת "רפואה
		// משלימה" לא תציג על עצמה "אחר" (או כלום) כשנכנסים אליה
		business: { ...business, category: resolveCategory(business) },
		// "שיתוף חכם" הוא כלי של בעל העסק בלבד. ההכרעה כאן ולא בדפדפן:
		// toBusiness לא מחזיר ללקוח את מפתחות הבעלות, ולכן אין מה לזייף.
		// אדמין מקבל גישה גם הוא — הוא כבר עורך ומאשר את הכרטיסיות.
		canSmartShare: admin || isBusinessOwner(b, user),
		// כפתור "ערוך": לאדמין בכל הדפים, ולבעלים על הדף שלו בלבד
		canEdit: canEditBusiness(b, user),
		// רמזים על שדות ריקים (למשל סרטון תדמית שלא מולא) מוצגים רק למי
		// שיכול למלא אותם, ורק לאדמין מוצג קישור ישיר למסך העריכה.
		isAdmin: admin,
		// "זה העסק שלי" — מצב בקשת הבעלות מבחינת הגולש הנוכחי
		claim: {
			// כרטיסייה בלי בעלים אפשר לדרוש; אחרי בקשה מוצג הסטטוס במקום הכפתור
			open: !owned,
			loggedIn: !!user,
			status: claim?.status ?? '',
			// התאמה אוטומטית — "זיהינו שהעסק הזה שלך" ולא סתם הזמנה כללית
			matchedBy: user && !owned ? matchKind(b, { email: user.email, phone: userPhone }) : ''
		}
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * בקשת בעלות על הכרטיסייה. הבקשה נכנסת כ-pending ומחכה לאישור אדמין —
	 * אין כאן שום שינוי הרשאה מיידי, גם כשהטלפון מתאים בול.
	 */
	claim: async ({ request, params, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { claimError: 'צריך להתחבר כדי לדרוש את הכרטיסייה' });

		const b = await getBusiness(params.id);
		if (!b) return fail(404, { claimError: 'העסק לא נמצא' });
		if (businessOwnerId(b)) return fail(400, { claimError: 'לכרטיסייה הזו כבר יש בעלים רשום' });

		const fd = await request.formData();
		const note = String(fd.get('note') ?? '').trim();
		const userPhone = await getUserPhone(user.id);

		const res = await createClaim({
			bizDocId: b.documentId,
			bizName: b.name || '',
			userId: user.id,
			userName: user.name,
			userEmail: user.email,
			userPhone,
			matchedBy: matchKind(b, { email: user.email, phone: userPhone }) || 'manual',
			note
		});
		if (!res.ok) return fail(400, { claimError: res.error });

		// הבועה האדומה של האדמין נגזרת ממטמון של דקה — מאפסים כדי שהבקשה תופיע מיד
		invalidatePendingCounts();
		return { claimed: true };
	}
};
