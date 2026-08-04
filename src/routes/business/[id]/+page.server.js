import { error } from '@sveltejs/kit';
import { getBusiness, getUserPhone, isPrivileged } from '$lib/server/strapi.js';
import { toBusiness } from '$lib/businessShape.js';
import { canonicalPhoneKey } from '$lib/phoneIL.js';

/**
 * האם המשתמש המחובר הוא בעל הכרטיסייה.
 * הגשה דרך הטופס שומרת שיוך-משתמש (relation user + user_id), אבל רוב
 * הכרטיסיות הוזרמו בייבוא ונוצרו בלי שיוך — ולאוסף idx-business אין שדה
 * אימייל. הקישור היחיד שנשאר להן הוא הטלפון, וזה גם המפתח שהאזור האישי
 * מזהה לפיו. שני המספרים מנורמלים כי הם נכתבים בכל מיני צורות.
 * @param {any} b רשומת idx-business הגולמית מ-Strapi
 * @param {any} user locals.user
 * @param {string} userPhone הטלפון מפרופיל המשתמש
 */
function isOwner(b, user, userPhone) {
	if (!user) return false;

	const uid = String(user.id ?? '');
	if (uid && (String(b?.user_id ?? '') === uid || String(b?.user?.id ?? '') === uid)) return true;

	const bizKey = canonicalPhoneKey(b?.phone);
	return !!bizKey && canonicalPhoneKey(userPhone) === bizKey;
}

// טעינת עסק בודד לפי documentId יציב (מחליף את array-index השביר). 404 אמיתי.
export async function load({ params, locals }) {
	// הטלפון של המשתמש נשלף במקביל לעסק ולא אחריו — כדי שבדיקת הבעלות לא
	// תוסיף סבב רשת להשהיית הדף. מבקר אנונימי (וסורק) לא משלם עליה כלל.
	const [b, userPhone] = await Promise.all([
		getBusiness(params.id),
		locals.user ? getUserPhone(locals.user.id) : Promise.resolve('')
	]);
	if (!b) throw error(404, 'העסק לא נמצא או ממתין לאישור');

	return {
		business: toBusiness(b),
		// "שיתוף חכם" הוא כלי של בעל העסק בלבד. ההכרעה כאן ולא בדפדפן:
		// toBusiness לא מחזיר ללקוח את מפתחות הבעלות, ולכן אין מה לזייף.
		// אדמין מקבל גישה גם הוא — הוא כבר עורך ומאשר את הכרטיסיות.
		canSmartShare: isPrivileged(locals.user) || isOwner(b, locals.user, userPhone)
	};
}
