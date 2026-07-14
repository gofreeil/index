import { json } from '@sveltejs/kit';
import { listApprovedBusinesses } from '$lib/server/strapi.js';
import { toLegacyBusiness } from '$lib/businessShape.js';

// מקור העסקים: idx-business ב-Strapi (מאושרים בלבד). מחליף את Google Sheets.
// הפלט כולל גם מפתחות אנגלית נקיים (לפרונט של index) וגם מפתחות עבריים +
// logoFromColumnJ — חוזה עם ה-importer של community (indexBusinesses.ts) שאסור לשבור.
// Cache ברמת CDN (s-maxage) במקום module-scope שנשבר ב-serverless.
export async function GET({ setHeaders }) {
	try {
		const rows = await listApprovedBusinesses();
		const out = rows.map(toLegacyBusiness);
		setHeaders({ 'cache-control': 's-maxage=300, stale-while-revalidate=600' });
		return json(out);
	} catch (error) {
		console.error('businesses shim error:', error);
		// fail-soft: מערך ריק כדי לא להפיל את community (fetch שלו כבר סופג ריק)
		return json([]);
	}
}
