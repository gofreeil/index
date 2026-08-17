// ============================================================
// seo.ts — מקור אמת יחיד ל-SEO + Structured Data (JSON-LD)
// כל ה-URLים הקנוניים, שם המותג ומחוללי schema.org עוברים מכאן.
// משמש את ה-<svelte:head> בכל דף, את ה-sitemap ואת ה-AI crawlers.
// ============================================================

/** הדומיין הקנוני היחיד. כל canonical / og:url / sitemap מצביעים לכאן. */
export const SITE_URL = 'https://index.gofreeil.com';
export const SITE_NAME = 'בעלי מקצוע כשירים';
export const SITE_TAGLINE = 'בהנחות והטבות ייחודיות לחברי יוצאים לחירות';
export const SITE_DESCRIPTION =
	'אינדקס בעלי מקצוע כשירים — חשמלאים, אינסטלטורים, שיפוצניקים, מזגנים, הובלות, מחשבים, עורכי דין, יופי וטיפוח, אוכל ואירועים. כל בעל מקצוע חתם על אמנת הקהילה, מדורג בידי הלקוחות ומעניק הנחה לחברי הקהילה. חיפוש לפי תחום ולפי עיר — חינם.';
/** ?v=4 — מכריח את פייסבוק/וואטסאפ לגרד מחדש אחרי החלפת הלוגו; הם ממטמנים לפי כתובת */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png?v=4`;
export const SITE_LOGO = `${SITE_URL}/og-image.png?v=4`;
export const CONTACT_EMAIL = 'freedomhasbegun@gmail.com';

/** בונה URL מוחלט קנוני מנתיב יחסי. */
export function canonical(path = '/'): string {
	if (!path.startsWith('/')) path = '/' + path;
	return path === '/' ? SITE_URL : SITE_URL + path;
}

// ============================================================
// ---- רשת "יוצאים לחירות" ----
// קישורים הדדיים בין כל אתרי הרשת: כל אתר מקשר לאחרים בעוגן תיאורי,
// וכל Organization מצהיר על שיוך לתנועת האם. כך גוגל ומנועי ה-AI
// מזהים את כולם כישות אחת ומחלקים ביניהם את האמון (entity consolidation).
// רשימה זהה קיימת בכל מאגרי הרשת — עדכון כאן מחייב עדכון מקביל בכולם.
// ============================================================

export interface NetworkSiteLink {
	/** שם האתר כפי שמופיע בעוגן הקישור */
	name: string;
	url: string;
	/** תיאור קצר — משמש כ-title לקישור וכתוכן ל-llms.txt */
	description: string;
}

/** אתר האם של התנועה — הורה ארגוני לכל אתרי הרשת. */
export const PARENT_SITE: NetworkSiteLink = {
	name: 'יוצאים לחירות',
	url: 'https://gofreeil.com',
	description: 'התנועה החברתית שמאחדת את כל אתרי הרשת — מתקדמים לעולם סולידרי, אחראי וחופשי'
};

export const NETWORK_SITES: NetworkSiteLink[] = [
	PARENT_SITE,
	{
		name: 'קהילה בשכונה',
		url: 'https://community.gofreeil.com',
		description: 'כל יתרונות השכונה במקום אחד: יד שנייה, דירות, שידוכים, חוגים, בייבי סיטר וטרמפים'
	},
	{
		name: 'הגמ"ח הארצי',
		url: 'https://gemach.gofreeil.com',
		description: 'מאגר הגמ"חים הארצי — השאלת ציוד רפואי, ריהוט, שמלות וכלי אירוח בחינם'
	},
	{
		name: 'בעלי מקצוע כשירים',
		url: 'https://index.gofreeil.com',
		description: 'אינדקס בעלי מקצוע מדורגים שהתחייבו לאמנת הקהילה ולהטבות לחברי הקהילה'
	},
	{
		name: 'חכמי העדה — בתי הפיוס',
		url: 'https://chachmim.gofreeil.com',
		description: 'בוררות, פיוס ופתרון סכסוכים על פי תורת ישראל, בהתנדבות'
	},
	{
		name: 'רכישות קבוצתיות',
		url: 'https://groups.gofreeil.com',
		description: 'קבוצות רכישה שמורידות מחירים — סלולר, דלק, ביטוח וחשמל'
	},
	{
		name: 'פינת האבדות',
		url: 'https://avedot.gofreeil.com',
		description: 'לוח אבידות ומציאות ארצי — פרסום וחיפוש חינם'
	},
	{
		name: 'ועדי שכונות',
		url: 'https://neighborhoods.gofreeil.com',
		description: 'ועדי שכונות ומשילות התושבים על המוסדות המקומיים'
	},
	{
		name: 'מבקר רשויות המדינה',
		url: 'https://criticism.gofreeil.com',
		description: 'ביקורת ציבורית על הרשויות ומימוש זכויות התושב'
	},
	{
		name: 'דירוג ציבורי',
		url: 'https://rating.gofreeil.com',
		description: 'העם מדרג את הרשויות ואת עובדי הציבור'
	},
	{
		name: 'משאלי העם',
		url: 'https://referendum.gofreeil.com',
		description: 'הבעת דעה על הסוגיות האקטואליות שעל סדר היום'
	},
	{
		name: 'חנות החירות',
		url: 'https://shop.gofreeil.com',
		description: 'מוצרים נבחרים לבריאות טבעית, חקלאות ביתית וטכנולוגיה'
	}
];

/** אתרי הרשת ללא האתר הנוכחי — לשורת הקישורים בפוטר. */
export const OTHER_NETWORK_SITES = NETWORK_SITES.filter((s) => !SITE_URL.startsWith(s.url));

// ============================================================
// ---- מחוללי schema.org (JSON-LD) ----
// ============================================================

/** WebSite — זהות האתר, שפה וקישורי הרשת */
export function websiteSchema() {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		name: SITE_NAME,
		alternateName: ['מדריך בעלי מקצוע כשירים', 'אינדקס בעלי מקצוע', 'בעלי מקצוע יוצאים לחירות'],
		url: SITE_URL,
		description: SITE_DESCRIPTION,
		inLanguage: 'he-IL',
		publisher: { '@id': `${SITE_URL}/#organization` },
		relatedLink: NETWORK_SITES.filter((s) => !SITE_URL.startsWith(s.url)).map((s) => s.url)
	};
}

/** Organization — זהות המותג למנועי חיפוש ול-AI, כולל שיוך לתנועת האם */
export function organizationSchema() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${SITE_URL}/#organization`,
		name: SITE_NAME,
		url: SITE_URL,
		logo: { '@type': 'ImageObject', url: SITE_LOGO },
		image: SITE_LOGO,
		description: SITE_DESCRIPTION,
		email: CONTACT_EMAIL,
		areaServed: { '@type': 'Country', name: 'Israel' },
		inLanguage: 'he-IL',
		parentOrganization: {
			'@type': 'Organization',
			name: PARENT_SITE.name,
			url: PARENT_SITE.url
		},
		sameAs: NETWORK_SITES.filter((s) => !SITE_URL.startsWith(s.url)).map((s) => s.url)
	};
}

/** פירורי לחם — מסלול ניווט שגוגל מציג בתוצאות */
export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((it, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: it.name,
			item: canonical(it.path)
		}))
	};
}

/** CollectionPage + ItemList — לדף הבית (האינדקס) */
export function collectionSchema(opts: {
	name: string;
	description: string;
	path: string;
	items?: Array<{ name: string; path: string }>;
	numberOfItems?: number;
}) {
	const schema: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: opts.name,
		description: opts.description,
		url: canonical(opts.path),
		inLanguage: 'he-IL',
		isPartOf: { '@id': `${SITE_URL}/#website` }
	};
	if (opts.items?.length) {
		schema.mainEntity = {
			'@type': 'ItemList',
			numberOfItems: opts.numberOfItems ?? opts.items.length,
			itemListElement: opts.items.slice(0, 100).map((it, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				name: it.name,
				url: canonical(it.path)
			}))
		};
	}
	return schema;
}

/** FAQPage — שאלות ותשובות שגוגל ו-AI אוהבים לצטט */
export function faqSchema(qa: Array<{ q: string; a: string; link?: { href: string; label: string } }>) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		// קישור שמוצג בסוף התשובה בעמוד נכלל גם בטקסט הסכימה, כדי שהסכימה
		// תשקף את התוכן הגלוי במלואו.
		mainEntity: qa.map(({ q, a, link }) => ({
			'@type': 'Question',
			name: q,
			acceptedAnswer: { '@type': 'Answer', text: link ? `${a} ${link.label}: ${link.href}` : a }
		}))
	};
}

/** Service — מה האתר מציע (לדף הבית) */
export function serviceSchema() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Service',
		name: 'אינדקס בעלי מקצוע כשירים',
		serviceType: 'איתור בעלי מקצוע מומלצים ומדורגים',
		description:
			'איתור בעלי מקצוע לפי תחום ולפי עיר, עם דירוגים וחוות דעת של לקוחות, התחייבות לאמנת הקהילה והנחה לחברי הקהילה. השירות חינמי למחפשים.',
		provider: { '@id': `${SITE_URL}/#organization` },
		areaServed: { '@type': 'Country', name: 'Israel' },
		url: SITE_URL,
		isAccessibleForFree: true
	};
}

/** LocalBusiness — דף בעל מקצוע בודד, כולל דירוג וחוות דעת */
export function professionalSchema(opts: {
	name: string;
	description?: string;
	path: string;
	category?: string;
	phone?: string;
	website?: string;
	image?: string;
	address?: string;
	city?: string;
	areaServed?: string;
	lat?: number | null;
	lng?: number | null;
	rating?: number;
	ratingCount?: number;
	reviews?: Array<{ author?: string; rating?: number; comment?: string; date?: string }>;
	sameAs?: string[];
}) {
	const url = canonical(opts.path);
	const schema: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'LocalBusiness',
		'@id': `${url}#business`,
		name: opts.name,
		url,
		inLanguage: 'he-IL',
		...(opts.description ? { description: opts.description } : {}),
		...(opts.category ? { additionalType: 'ProfessionalService', knowsAbout: opts.category } : {}),
		...(opts.phone ? { telephone: opts.phone } : {}),
		...(opts.image ? { image: opts.image } : { image: SITE_LOGO }),
		...(opts.website || opts.sameAs?.length
			? { sameAs: [opts.website, ...(opts.sameAs ?? [])].filter(Boolean) }
			: {}),
		...(opts.address || opts.city
			? {
					address: {
						'@type': 'PostalAddress',
						...(opts.address ? { streetAddress: opts.address } : {}),
						...(opts.city ? { addressLocality: opts.city } : {}),
						addressCountry: 'IL'
					}
				}
			: {}),
		...(opts.areaServed ? { areaServed: { '@type': 'Place', name: opts.areaServed } } : {}),
		...(typeof opts.lat === 'number' && typeof opts.lng === 'number'
			? { geo: { '@type': 'GeoCoordinates', latitude: opts.lat, longitude: opts.lng } }
			: {}),
		isPartOf: { '@id': `${SITE_URL}/#website` }
	};
	// דירוג מוצהר רק כשיש חוות דעת אמיתיות — aggregateRating בלי ביקורות
	// נחשב ספאם ע"י גוגל ועלול להביא ידנית-פנלטי
	if (opts.rating && opts.ratingCount) {
		schema.aggregateRating = {
			'@type': 'AggregateRating',
			ratingValue: Number(opts.rating.toFixed(1)),
			reviewCount: opts.ratingCount,
			bestRating: 5,
			worstRating: 1
		};
	}
	const reviews = (opts.reviews ?? []).filter((r) => r.comment || r.rating);
	if (reviews.length) {
		schema.review = reviews.slice(0, 10).map((r) => ({
			'@type': 'Review',
			...(r.author ? { author: { '@type': 'Person', name: r.author } } : {}),
			...(r.rating
				? {
						reviewRating: {
							'@type': 'Rating',
							ratingValue: r.rating,
							bestRating: 5,
							worstRating: 1
						}
					}
				: {}),
			...(r.comment ? { reviewBody: r.comment } : {}),
			...(r.date ? { datePublished: r.date } : {})
		}));
	}
	return schema;
}
