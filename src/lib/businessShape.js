// ממיר רשומת idx-business מ-Strapi לצורה שהפרונט צורך (מפתחות אנגלית נקיים).
// משמש גם את ה-shim של /api/businesses וגם את עמוד העסק.
const MEDIA_BASE = 'https://api.gofreeil.com';

/** @param {any} m מדיה בודדת של Strapi */
export function mediaUrl(m) {
	const url = m?.url || '';
	if (!url) return '';
	return url.startsWith('http') ? url : MEDIA_BASE + url;
}

/** תוויות סטטוס בעברית + צבעי pill — לפאנל הניהול. */
export const STATUS_HE = /** @type {Record<string, [string, string]>} */ ({
	pending: ['ממתין', 'bg-blue-900/40 text-blue-300 border-blue-500/30'],
	approved: ['מאושר', 'bg-green-900/40 text-green-300 border-green-500/30'],
	rejected: ['נדחה', 'bg-red-900/40 text-red-300 border-red-500/30'],
	frozen: ['מוקפא', 'bg-gray-800 text-gray-300 border-gray-600/40']
});

/** @param {any} b רשומת idx-business מ-Strapi (מבנה שטוח של Strapi 5) */
export function toBusiness(b) {
	const logo = mediaUrl(b.logo) || (b.logo_url ? String(b.logo_url).trim() : '');
	const banners = Array.isArray(b.banners)
		? b.banners.map(mediaUrl).filter(Boolean)
		: b.banners_urls
			? String(b.banners_urls)
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
	return {
		documentId: b.documentId,
		slug: b.slug || b.documentId,
		name: b.name || '',
		category: b.category || '',
		subcategory: b.subcategory || '',
		description: b.description || '',
		unique_content: b.unique_content || '',
		contact_name: b.contact_name || '',
		phone: b.phone || '',
		website: b.website || '',
		whatsapp: b.whatsapp || '',
		facebook: b.facebook || '',
		instagram: b.instagram || '',
		youtube: b.youtube || '',
		address: b.address || '',
		city: b.city || '',
		neighborhood: b.neighborhood || '',
		sales_area: b.sales_area || '',
		discount: b.discount || '',
		accepted_terms: !!b.accepted_terms,
		logo,
		banners,
		banner: banners[0] || '',
		lat: typeof b.lat === 'number' ? b.lat : null,
		lng: typeof b.lng === 'number' ? b.lng : null,
		rating: Number(b.rating_avg || 0),
		rating_count: Number(b.rating_count || 0),
		view_count: Number(b.view_count || 0),
		created_at: b.createdAt || ''
	};
}

/**
 * צורה תואמת-לאחור עבור ה-importer של community (מפתחות עבריים verbatim + logoFromColumnJ).
 * ממזג את המפתחות הנקיים כדי שגם הפרונט של index יוכל לצרוך מאותו endpoint.
 * @param {any} b רשומת idx-business מ-Strapi
 */
export function toLegacyBusiness(b) {
	const clean = toBusiness(b);
	return {
		...clean,
		// מפתחות עבריים — חוזה עם community/my_new_project/src/lib/server/indexBusinesses.ts
		'שם העסק': clean.name,
		'שם איש קשר': clean.contact_name,
		טלפון: clean.phone,
		'מיקום המפעל / חנות / מחסן': clean.address,
		'תוכן ייחודי': clean.unique_content,
		'תיאור העסק': clean.description,
		קטגוריה: clean.category,
		'ההנחה הבלעדית': clean.discount,
		'אני מקבל על עצמי את תנאי הקהילה': clean.accepted_terms ? 'כן' : '',
		'אזור מכירה': clean.sales_area,
		'קישור לווצאפ': clean.whatsapp,
		'קישור לדף הפייסבוק': clean.facebook,
		'קישור לאתר שלך': clean.website,
		'קישור לאינסטגרם': clean.instagram,
		'חותמת זמן': clean.created_at,
		logoFromColumnJ: clean.logo
	};
}
