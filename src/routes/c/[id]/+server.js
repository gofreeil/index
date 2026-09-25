import { redirect } from '@sveltejs/kit';
import { parseClaimLink, recordClaimEvent, setClaimInviteCookie } from '$lib/server/claimSms.js';

/**
 * קיצור לקישור "זה העסק שלי" שנשלח ב-SMS. ההודעה היא 70 תווים למקטע
 * בעברית, וכתובת מלאה של דף העסק אוכלת מקטע שלם — ולכן הקישור בהודעה
 * הוא /c/<id>... בלבד, והוא מפנה לדף העסק עם התיבה פתוחה. קישור חתום
 * (<id>.<userId>.<sig>) נרשם כעוגייה — ומי שהוא נשלח אליו מקבל בעלות מיד.
 * @type {import('./$types').RequestHandler}
 */
export async function GET({ params, cookies }) {
	const link = parseClaimLink(params.id);
	if (!link) redirect(302, '/');
	if (link.userId) {
		setClaimInviteCookie(cookies, link.bizDocId, link.userId);
		await recordClaimEvent(link.bizDocId, link.userId, 'open');
	}
	redirect(302, `/business/${encodeURIComponent(link.bizDocId)}?claim=1#claim`);
}
