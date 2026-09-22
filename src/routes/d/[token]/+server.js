import { redirect } from '@sveltejs/kit';

/**
 * קיצור לקישור "לא שלי" שנשלח ב-SMS — ראו c/[id]. הדף עצמו נשאר ב-
 * /claim/decline/<token>, כולל הקישורים הארוכים שכבר יצאו בהודעות ישנות.
 * @type {import('./$types').RequestHandler}
 */
export function GET({ params }) {
	redirect(302, `/claim/decline/${encodeURIComponent(params.token)}`);
}
