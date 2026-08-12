// ממיר רשומת idx-business מ-Strapi לצורה שהפרונט צורך (מפתחות אנגלית נקיים).
// משמש גם את ה-shim של /api/businesses וגם את עמוד העסק.
// מקור אחד לדומיין המדיה — אותו דומיין מוצהר גם כמורשה בממטב התמונות
// (ראו mediaConfig.js ו-svelte.config.js), ופיצול ביניהם היה משתיק את המיטוב
import { MEDIA_BASE } from './mediaConfig.js';
import { parseBranches } from './branches.js';
import { parseExtraLinks } from './socialLinks.js';
import { parseFit, parseFitList, parseLogoShape, parseMainIndex } from './mediaFit.js';

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
	// טיקטוק, X, לינקדאין וקישור "נוסף" — אין להם עמודה, והם יושבים באותה
	// עמודת json של הסניפים ואימייל הבעלים (ראו socialLinks.js). כאן הם
	// עולים לרמה העליונה, כדי שהפרונט יצרוך את כל הקישורים באותה צורה.
	const links = parseExtraLinks(b.extra_fields?.links);
	// התמונה הראשית שבחר בעל העסק — הבאנר של האריח, הפתיחה של הגלריה
	// ותמונת השיתוף. ברירת המחדל היא הראשונה שהועלתה (ראו mediaFit.js).
	const mainIndex = parseMainIndex(b.extra_fields?.media_fit?.main, banners.length);
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
		tiktok: links.tiktok || '',
		x: links.x || '',
		linkedin: links.linkedin || '',
		extra: links.extra || '',
		// סרטון התדמית — שדה נפרד מערוץ היוטיוב (ראו socialLinks.js)
		video: links.video || '',
		address: b.address || '',
		city: b.city || '',
		neighborhood: b.neighborhood || '',
		sales_area: b.sales_area || '',
		// סניפים ומקומות שירות נוספים יושבים ב-extra_fields (אין להם עמודה
		// משלהם). רק הם נשלפים משם — שאר המפתחות באותה עמודה, ובראשם אימייל
		// הבעלים, לא נחשפים ללקוח.
		branches: parseBranches(b.extra_fields?.branches),
		discount: b.discount || '',
		accepted_terms: !!b.accepted_terms,
		logo,
		banners,
		main_index: mainIndex,
		banner: banners[mainIndex] || banners[0] || '',
		// מיקום וזום שנקבעו בעורך (extra_fields.media_fit). ברירת מחדל = מרכז,
		// ואז התצוגה לא נוגעת ב-CSS המקורי בכלל (ראו mediaFit.js)
		logo_fit: parseFit(b.extra_fields?.media_fit?.logo),
		banner_fits: parseFitList(b.extra_fields?.media_fit?.banners),
		// מסגרת הלוגו בכרטיסייה: ריבוע מעוגל (ברירת מחדל) או עיגול
		logo_shape: parseLogoShape(b.extra_fields?.media_fit?.logo_shape),
		lat: typeof b.lat === 'number' ? b.lat : null,
		lng: typeof b.lng === 'number' ? b.lng : null,
		rating: Number(b.rating_avg || 0),
		rating_count: Number(b.rating_count || 0),
		view_count: Number(b.view_count || 0),
		// כמה פעמים נלחץ "הצג מספר טלפון" — המדד הישיר ביותר לפניות,
		// מוצג לבעל הכרטיסייה באזור האישי ולאדמין ב-/admin/stats
		phone_reveal_count: Number(b.phone_reveal_count || 0),
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
