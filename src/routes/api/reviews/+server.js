import { json } from '@sveltejs/kit';
import { listReviews, createReview } from '$lib/server/strapi.js';

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
				author_city: r.author_city || '',
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

// POST — יצירת ביקורת (status=pending נכפה בבאקאנד). אם המשתמש מחובר, מצורף כבעלים
// דרך ה-session (locals). כתיבה עוברת עם STRAPI_TOKEN, לא ישירות מהדפדפן ל-Strapi.
export async function POST({ request, locals }) {
	try {
		const { businessId, businessSlug, rating, comment, title, authorName, authorCity } =
			await request.json();
		const r = Math.max(1, Math.min(5, Number(rating) || 0));
		if (!businessId || !r) {
			return json({ success: false, error: 'חסרים פרטים' }, { status: 400 });
		}
		await createReview({
			business: businessId,
			business_slug: businessSlug || '',
			rating: r,
			title: (title || '').slice(0, 120),
			body: (comment || '').slice(0, 2000),
			author_name: (authorName || locals.user?.name || 'אנונימי').slice(0, 80),
			author_city: (authorCity || '').slice(0, 80)
		});
		return json({ success: true });
	} catch (e) {
		console.error('reviews POST error:', e);
		return json({ success: false, error: 'שליחת חוות הדעת נכשלה' }, { status: 502 });
	}
}
