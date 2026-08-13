import { json } from '@sveltejs/kit';
import { listReviews, createReview, findUserReview, setStatus } from '$lib/server/strapi.js';
import { SESSION_COOKIE, SHARED_SSO_COOKIE } from '$lib/server/session.js';

// ביקורות על עסקי האינדקס — מגובות ב-idx-review ב-Strapi (מודרציה אמיתית).
// GET מחזיר רק ביקורות מאושרות של העסק (לפי documentId).
export async function GET({ url }) {
	const businessId = url.searchParams.get('businessId');
	if (!businessId) return json([]);
	try {
		const rows = await listReviews(businessId);
		return json(
			rows.map((/** @type {any} */ r) => ({
				id: r.documentId,
				author_name: r.author_name || 'אנונימי',
				rating: Number(r.rating || 0),
				title: r.title || '',
				body: r.body || '',
				date: (r.submitted_at || r.createdAt || '').slice(0, 10)
			}))
		);
	} catch (e) {
		console.error('reviews GET error:', e);
		return json([]);
	}
}

// ── הגבלת קצב ────────────────────────────────────────────────
// דלי לפי מזהה משתמש ולא לפי IP: הכתיבה דורשת התחברות ממילא, וחשבון הוא
// המחסום האמיתי — החלפת IP לא עוקפת אותו. הזיכרון הוא של התהליך; אחרי דיפלוי
// הדלי מתאפס, וזה מקובל כאן כי הבלימה האמיתית היא בדיקת הכפילות שמתחתיה.
/** @type {Map<string, {count:number, resetAt:number}>} */
const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** @param {string} userId */
function rateLimited(userId) {
	const now = Date.now();
	const b = buckets.get(userId);
	if (!b || now > b.resetAt) {
		buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}
	if (b.count >= MAX_PER_WINDOW) return true;
	b.count += 1;
	return false;
}

// POST — יצירת ביקורת ופרסומה מיד, בלי להמתין לאישור. מחייב התחברות: בלי זה
// אפשר היה להציף את תור המודרציה ולחתום בשם של אדם אחר, שכן שם המחבר הגיע
// מגוף הבקשה. עכשיו השם נלקח מה-session בלבד, וגוף הבקשה לא נשאל.
//
// הבקשה יוצאת עם ה-JWT של המשתמש, כדי שה-controller בבאקאנד יצמיד את הזהות
// (user/user_id) מ-ctx.state.user. Strapi נשאר ה-gatekeeper: הכתיבה לעולם לא
// יוצאת מהדפדפן ישירות.
export async function POST({ request, locals, cookies }) {
	if (!locals.user) {
		return json(
			{ success: false, code: 'auth', error: 'יש להתחבר כדי להוסיף חוות דעת' },
			{ status: 401 }
		);
	}
	try {
		const { businessId, businessSlug, rating, comment, title } = await request.json();
		const r = Math.max(1, Math.min(5, Number(rating) || 0));
		if (!businessId || !r) {
			return json({ success: false, code: 'invalid', error: 'חסרים פרטים' }, { status: 400 });
		}

		if (rateLimited(locals.user.id)) {
			return json(
				{ success: false, code: 'rate', error: 'נשלחו יותר מדי חוות דעת. נסו שוב מאוחר יותר.' },
				{ status: 429 }
			);
		}

		// חוות דעת אחת לאדם לעסק. כשל בבדיקה עצמה לא חוסם את ההגשה — עדיף
		// כפילות נדירה שהמנהל ידחה, מאשר טופס שנופל בגלל תקלת רשת רגעית.
		const existing = await findUserReview(businessId, locals.user.id).catch(() => null);
		if (existing) {
			return json(
				{ success: false, code: 'duplicate', error: 'כבר כתבת חוות דעת על העסק הזה' },
				{ status: 409 }
			);
		}

		const payload = {
			business: businessId,
			business_slug: businessSlug || '',
			rating: r,
			title: (title || '').slice(0, 120),
			body: (comment || '').slice(0, 2000),
			author_name: locals.user.name || 'אנונימי'
		};
		// מסלול ה-JWT הוא best-effort בלבד: הצמדת הזהות שווה ניסיון, אבל לא במחיר
		// טופס שבור. כל כישלון שלו — ולא רק 401/403 — נופל לטוקן השרת, שהוא המסלול
		// שתמיד מורשה לכתוב. הצמצום הקודם ל-40[13] הוא מה ששבר את הטופס בפועל:
		// Strapi החזיר על הבקשה עם ה-JWT סטטוס אחר, השגיאה נזרקה הלאה, והמשתמש
		// קיבל "שגיאה בשליחת חוות הדעת" למרות ששליחה בטוקן השרת עוברת.
		const jwt = cookies.get(SESSION_COOKIE) || cookies.get(SHARED_SSO_COOKIE);
		/** @type {any} */
		let created = null;
		if (jwt) {
			try {
				created = await createReview(payload, jwt);
			} catch (e) {
				// הסטטוס נשמר בלוג — בלעדיו אי אפשר לדעת למה הזהות לא הוצמדה.
				console.warn('reviews POST: JWT path failed, falling back to server token:', e);
			}
		}
		if (!created) created = await createReview(payload);

		// פרסום מיידי. ה-controller בבאקאנד כופה status=pending על כל הגשה, ולכן
		// האישור נעשה כאן מיד אחרי היצירה, בטוקן השרת (api-token = מהימן שם).
		// ה-update בבאקאנד גם מריץ חישוב-מחדש של דירוג העסק, כך שהממוצע והמונה
		// מתעדכנים באותה פעולה ולא נשארים מאחור.
		// best-effort: אם האישור נכשל הביקורת נשארת ממתינה לאדמין — עדיף מזה
		// שהמשתמש יראה "השליחה נכשלה" על חוות דעת שכן נשמרה.
		const docId = created?.data?.documentId;
		let published = false;
		if (docId) {
			try {
				await setStatus('review', docId, 'approved');
				published = true;
			} catch (e) {
				console.warn('reviews POST: auto-approve failed, review left pending:', e);
			}
		}
		return json({ success: true, published });
	} catch (e) {
		console.error('reviews POST error:', e);
		return json(
			{ success: false, code: 'server', error: 'שליחת חוות הדעת נכשלה' },
			{ status: 502 }
		);
	}
}
