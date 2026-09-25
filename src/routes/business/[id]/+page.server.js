import { error, fail } from '@sveltejs/kit';
import { assignBusinessOwner, getBusiness, isPrivileged } from '$lib/server/strapi.js';
import { getEffectivePhone } from '$lib/server/profileStore.js';
import { getCategorySettings } from '$lib/server/categoryStore.js';
import { toBusiness } from '$lib/businessShape.js';
import {
	resolveCategory,
	canonicalCategoryLabel,
	categoryDisplayResolver,
	retiredLabelSet
} from '$lib/categories.js';
import {
	businessOwnerId,
	canEditBusiness,
	invalidateMatches,
	invalidateUserMatchCount,
	isBusinessOwner,
	matchKind
} from '$lib/server/ownerMatch.js';
import { createClaim, decideClaim, findClaim, invalidateClaims } from '$lib/server/claimsStore.js';
import { claimInviteUser, recordClaimEvent } from '$lib/server/claimSms.js';
import { invalidatePendingCounts } from '$lib/server/pendingCounts.js';

/**
 * טעינת עסק בודד לפי documentId יציב (מחליף את array-index השביר). 404 אמיתי.
 *
 * הטלפון של המשתמש נשלף במקביל לעסק ולא אחריו — כדי שבדיקת הבעלות לא
 * תוסיף סבב רשת להשהיית הדף. מבקר אנונימי (וסורק) לא משלם עליה כלל.
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ params, locals, cookies }) {
	const user = locals.user;
	const [b, userPhone, catSettings] = await Promise.all([
		getBusiness(params.id),
		user ? getEffectivePhone(user.id) : Promise.resolve(''),
		getCategorySettings()
	]);
	if (!b) throw error(404, 'העסק לא נמצא או ממתין לאישור');

	const admin = isPrivileged(user);
	const business = toBusiness(b);

	// בעלות = שיוך שנכתב על הרשומה, לא התאמת פרטים. רוב הכרטיסיות הוזרמו
	// בייבוא ואין להן בעלים — אותן אפשר "לדרוש", והאדמין מכריע.
	const owned = !!businessOwnerId(b);
	const isOwner = isBusinessOwner(b, user);
	const claim = user ? await findClaim(business.documentId, user.id).catch(() => null) : null;
	// ההתאמה נבדקת גם על כרטיסייה שיש לה בעלים: אם הטלפון שבכרטיסייה הוא
	// של הגולש, ייתכן שהיא שויכה בטעות למישהו אחר — ואז הוא רשאי לבקש
	// *העברת* בעלות. הבעלים עצמו כמובן לא צריך לבקש כלום.
	const matchedBy = user && !isOwner ? matchKind(b, { email: user.email, phone: userPhone }) : '';
	// הגיע מהקישור החתום שה-SMS שלח בדיוק למשתמש הזה — בעלות בלחיצה, בלי אדמין
	const instant = !!user && !owned && claimInviteUser(cookies, business.documentId) === String(user.id);

	return {
		// אותו סיווג בדיוק כמו בדף הבית — כרטיסייה שהאינדקס מציג תחת "רפואה
		// משלימה" לא תציג על עצמה "אחר" (או כלום) כשנכנסים אליה. גם דריסות
		// השם של הסופר-אדמין חלות כאן, כדי שהצ'יפ יתאים למסילה.
		business: (() => {
			const displayName = categoryDisplayResolver(catSettings);
			const retired = retiredLabelSet(catSettings);
			const category = displayName(resolveCategory(business, retired));
			return {
				...business,
				category,
				// הקטגוריות הנוספות באותו תרגום תצוגה; מה שנמחק במסך הניהול
				// נשמט, והראשית לא מוצגת פעמיים
				extra_categories: [
					...new Set(
						business.extra_categories
							.map((/** @type {string} */ c) => displayName(canonicalCategoryLabel(c, retired)))
							.filter(Boolean)
					)
				].filter((c) => c !== category)
			};
		})(),
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
			// כרטיסייה בלי בעלים פתוחה לכל אחד לדרוש. כרטיסייה משויכת פתוחה
			// רק למי שהמערכת מזהה כבעליה האמיתי — בקשת העברה, לא הזמנה כללית.
			open: !isOwner && (!owned || !!matchedBy),
			// הבקשה היא העברת בעלות מבעלים קיים — הניסוח למשתמש שונה
			transfer: owned,
			loggedIn: !!user,
			status: claim?.status ?? '',
			// התאמה אוטומטית — "זיהינו שהעסק הזה שלך" ולא סתם הזמנה כללית
			matchedBy,
			instant
		}
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * בקשת בעלות על הכרטיסייה. הבקשה נכנסת כ-pending ומחכה לאישור אדמין —
	 * אין כאן שום שינוי הרשאה מיידי, גם כשהטלפון מתאים בול.
	 *
	 * כרטיסייה שכבר משויכת אינה סגורה לחלוטין: מי שהמערכת מזהה כבעליה
	 * (טלפון/אימייל זהים) רשאי לבקש *העברת* בעלות, והאדמין מכריע. בלי
	 * התאמה כזו אין דרך לבקש כרטיסייה של מישהו אחר.
	 */
	claim: async ({ request, params, locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { claimError: 'צריך להתחבר כדי לדרוש את הכרטיסייה' });

		const b = await getBusiness(params.id);
		if (!b) return fail(404, { claimError: 'העסק לא נמצא' });
		if (isBusinessOwner(b, user)) return fail(400, { claimError: 'הכרטיסייה כבר משויכת אליך' });

		const fd = await request.formData();
		const note = String(fd.get('note') ?? '').trim();
		const userPhone = await getEffectivePhone(user.id);
		const matchedBy = matchKind(b, { email: user.email, phone: userPhone });

		// הקישור החתום מה-SMS נשלח למשתמש הזה בדיוק, אחרי שהמערכת זיהתה אותו
		// ככבעלים — זו ההוכחה. כרטיסייה בלי בעלים עוברת אליו מיד; העברה
		// מבעלים קיים נשארת בהכרעת אדמין.
		const invited = claimInviteUser(cookies, b.documentId) === String(user.id);
		if (invited && !businessOwnerId(b)) {
			try {
				await assignBusinessOwner(b.documentId, { id: user.id, email: user.email });
			} catch (e) {
				return fail(502, { claimError: 'השיוך נכשל — נסו שוב' });
			}
			const created = await createClaim({
				bizDocId: b.documentId,
				bizName: b.name || '',
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				userPhone,
				matchedBy: matchedBy || 'manual',
				source: 'auto',
				note: 'שיוך אוטומטי מקישור ה-SMS החתום'
			}).catch(() => null);
			if (created?.ok) await decideClaim(created.claim.id, 'approved', 'sms:auto').catch(() => {});
			await recordClaimEvent(b.documentId, user.id, 'claimed');
			invalidateClaims();
			invalidateMatches();
			invalidatePendingCounts();
			invalidateUserMatchCount(user.id);
			return { claimedNow: true };
		}
		if (businessOwnerId(b) && !matchedBy) {
			return fail(400, { claimError: 'לכרטיסייה הזו כבר יש בעלים רשום' });
		}

		const res = await createClaim({
			bizDocId: b.documentId,
			bizName: b.name || '',
			userId: user.id,
			userName: user.name,
			userEmail: user.email,
			userPhone,
			matchedBy: matchedBy || 'manual',
			note,
			// כבר ווידאנו שהכרטיסייה אינה שלו — בקשה ישנה שאושרה ואז נותקה
			// לא צריכה לחסום אותו מלבקש שוב
			reclaim: true
		});
		if (!res.ok) return fail(400, { claimError: res.error });

		if (invited) await recordClaimEvent(b.documentId, user.id, 'request');
		// הבועה האדומה של האדמין נגזרת ממטמון של דקה — מאפסים כדי שהבקשה תופיע מיד
		invalidatePendingCounts();
		// ובועת "כרטיסיות מחכות לך" של המשתמש עצמו — הכרטיסייה כבר נדרשה
		invalidateUserMatchCount(user.id);
		return { claimed: true };
	}
};
