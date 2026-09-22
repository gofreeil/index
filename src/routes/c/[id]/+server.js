import { redirect } from '@sveltejs/kit';

/**
 * קיצור לקישור "זה העסק שלי" שנשלח ב-SMS. ההודעה היא 70 תווים למקטע
 * בעברית, וכתובת מלאה של דף העסק אוכלת מקטע שלם — ולכן הקישור בהודעה
 * הוא /c/<id> בלבד, והוא מפנה לדף העסק עם התיבה פתוחה.
 * @type {import('./$types').RequestHandler}
 */
export function GET({ params }) {
	redirect(302, `/business/${encodeURIComponent(params.id)}?claim=1#claim`);
}
