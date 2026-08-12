// ============================================================
// sitemap.xml — מפת האתר הדינמית. מפרטת את כל דפי בעלי המקצוע המאושרים,
// כדי שגוגל יגלה כל דף עסק בנפרד ולא רק את דף הבית.
// ============================================================

import { listApprovedBusinesses } from '$lib/server/strapi.js';
import { toBusiness } from '$lib/businessShape.js';
import { SITE_URL } from '$lib/seo';

export const prerender = false;

/** בריחת תווים אסורים ב-XML @param {string} s */
function xmlEscape(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export async function GET({ setHeaders }) {
	/** @type {any[]} */
	let businesses = [];
	try {
		businesses = (await listApprovedBusinesses()).map(toBusiness);
	} catch (err) {
		console.error('sitemap load error:', err);
		businesses = []; // תקלה ב-Strapi לא תפיל את מפת האתר
	}

	const staticUrls = [
		{ loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
		{ loc: `${SITE_URL}/submit-business`, changefreq: 'monthly', priority: '0.7' },
		{ loc: `${SITE_URL}/about/advertise`, changefreq: 'monthly', priority: '0.5' },
		// /privacy הוסר: הוא מפנה מחדש (301) ללשונית הפרטיות שבדף המשפטי,
		// וכתובת שמפנה מחדש לא אמורה להופיע במפת האתר.
		{ loc: `${SITE_URL}/about/legal`, changefreq: 'yearly', priority: '0.2' }
	];

	const bizUrls = businesses.map((b) => ({
		loc: `${SITE_URL}/business/${encodeURIComponent(b.documentId)}`,
		lastmod: b.created_at ? new Date(b.created_at).toISOString() : undefined,
		changefreq: 'weekly',
		priority: '0.8'
	}));

	const urls = [...staticUrls, ...bizUrls];

	const xml =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		urls
			.map(
				(u) =>
					`  <url>\n` +
					`    <loc>${xmlEscape(u.loc)}</loc>\n` +
					('lastmod' in u && u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
					`    <changefreq>${u.changefreq}</changefreq>\n` +
					`    <priority>${u.priority}</priority>\n` +
					`  </url>`
			)
			.join('\n') +
		`\n</urlset>`;

	setHeaders({
		'Content-Type': 'application/xml',
		'cache-control': 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600'
	});
	return new Response(xml);
}
