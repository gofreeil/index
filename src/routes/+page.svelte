<script>
	import { onMount, tick } from 'svelte';
	import LazyMap from '$lib/components/LazyMap.svelte';
	import { lang, translations } from '$lib/i18n';
	import BusinessCard from '$lib/components/BusinessCard.svelte';
	import CategoryRail from '$lib/components/CategoryRail.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { categoryIcon, OTHER } from '$lib/categories.js';
	import { suggestForQuery } from '$lib/searchSuggest.js';
	import { trackSearch } from '$lib/searchTrack.js';
	import { businessCities } from '$lib/cities.js';
	import { favorites } from '$lib/favorites.js';
	import { rememberCategory } from '$lib/lastCategory.js';
	import {
		SITE_NAME,
		SITE_DESCRIPTION,
		websiteSchema,
		organizationSchema,
		serviceSchema,
		collectionSchema
	} from '$lib/seo';

	/** @type {{ data: { businesses: any[], catRail?: { byName: Record<string, {icon: string, image: string, imageFit?: { x: number, y: number, z: number }}>, order: string[], otherName: string }, loadError: string | null } }} */
	let { data } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	// הרשימה מגיעה מהשרת (+page.server.js) ולכן מוגשת בתוך ה-HTML לגוגל ול-AI.
	const businesses = $derived(data.businesses);
	const error = $derived(data.loadError);
	let searchTerm = $state('');
	let selectedCategory = $state('all');
	let selectedLocation = $state('all');

	// Pagination
	let visibleCount = $state(9);
	let incrementBy = $state(21);
	function loadMore() {
		visibleCount += incrementBy;
	}

	onMount(() => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) {
			visibleCount = 6;
			incrementBy = 12;
		}
	});

	/* ═══════════ מסילת התחומים ═══════════
	   התחום של כל כרטיסייה כבר נקבע בשרת (resolveCategory + דריסות התצוגה
	   של הסופר-אדמין), ולכן כאן רק סופרים. הסדר: אם הסופר-אדמין קבע סדר
	   במסך ניהול הקטגוריות — הוא הקובע; אחרת לפי מספר העסקים בפועל — מה
	   שיש ממנו הכי הרבה באתר צריך להיות מה שרואים ראשון. "אחר" תמיד אחרון.
	   כל תחום חי מוצג, גם כשאין בו עדיין אף עסק: המסילה היא מפת התחומים
	   של האתר, ותחום שנעלם ממנה נקרא כ"האתר לא עוסק בזה" — גם למי שמחפש
	   וגם למי ששוקל להגיש עסק. תחום שנמחק במסך הניהול אינו מגיע לכאן
	   מלכתחילה (effectiveCategories מסנן אותו). */
	const railMeta = $derived(data.catRail?.byName ?? {});
	const railOrder = $derived(
		new Map(
			(data.catRail?.order ?? []).map((/** @type {string} */ n, /** @type {number} */ i) => [n, i])
		)
	);
	const otherName = $derived(data.catRail?.otherName ?? OTHER);
	const railCategories = $derived.by(() => {
		/** @type {Record<string, number>} */
		const counts = {};
		for (const b of businesses) {
			const key = b.category || otherName;
			counts[key] = (counts[key] ?? 0) + 1;
		}
		// railMeta = כל התחומים החיים (כולל הריקים); counts מוסיף תוויות חופשיות
		// שהוקלדו על כרטיסיות ואינן ברשימת הניהול — גם להן מגיע אריח
		const labels = new Set([...Object.keys(railMeta), ...Object.keys(counts)]);
		return [...labels]
			.map((label) => ({
				key: label,
				label,
				icon: railMeta[label]?.icon ?? categoryIcon(label),
				image: railMeta[label]?.image ?? '',
				imageFit: railMeta[label]?.imageFit,
				count: counts[label] ?? 0
			}))
			.sort(
				(a, b) =>
					(a.key === otherName ? 1 : 0) - (b.key === otherName ? 1 : 0) ||
					(railOrder.get(a.key) ?? Infinity) - (railOrder.get(b.key) ?? Infinity) ||
					b.count - a.count ||
					a.label.localeCompare(b.label, 'he')
			);
	});

	/* ═══════════ גלילה איטית אל התוצאות ═══════════
	   scroll-behavior: smooth של הדפדפן מסיים את המסע ב~300ms — מהיר מדי מכדי
	   שהעין תעקוב, והגולש נוחת בבת אחת במקום אחר בדף בלי לדעת מה חלף בדרך.
	   כאן הגלילה נמשכת קרוב לשנייה וחצי, עם האצה והאטה בקצוות, כך שהדף
	   "נוסע" מתחת לעין והגולש רואה שהוא עובר מהמסילה אל התוצאות שלה.

	   היעד נמדד מחדש בכל פריים: תמונות שנטענות תוך כדי הנסיעה מזיזות את
	   הבלוק, ומרחק שחושב פעם אחת בהתחלה היה מחטיא אותו.

	   כל נגיעה של הגולש בגלילה (גלגלת, אצבע, מקש) עוצרת מיד — המסך שלו. */
	const easeInOutCubic = (/** @type {number} */ t) =>
		t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

	const SCROLL_MS_PER_PX = 1.6; // מרחק ארוך = נסיעה ארוכה, בקצב אחיד
	const SCROLL_MS_MIN = 900;
	const SCROLL_MS_MAX = 2400;
	const USER_SCROLL_EVENTS = /** @type {const} */ ([
		'wheel',
		'touchstart',
		'keydown',
		'pointerdown'
	]);

	let scrollRaf = 0;
	/** @type {(() => void) | null} */
	let stopUserWatch = null;

	function cancelSlowScroll() {
		if (scrollRaf) cancelAnimationFrame(scrollRaf);
		scrollRaf = 0;
		stopUserWatch?.();
		stopUserWatch = null;
	}

	/** @param {HTMLElement} el */
	function slowScrollTo(el) {
		cancelSlowScroll();
		const header = document.querySelector('header');
		const offset = (header?.offsetHeight ?? 0) + 12;
		// מיקום מוחלט במסמך — אינו תלוי במקום הגלילה הנוכחי, רק בפריסה
		const targetTop = () => Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);

		const from = window.scrollY;
		const distance = Math.abs(targetTop() - from);
		if (distance < 4) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			window.scrollTo(0, targetTop());
			return;
		}

		const duration = Math.min(SCROLL_MS_MAX, Math.max(SCROLL_MS_MIN, distance * SCROLL_MS_PER_PX));
		const start = performance.now();

		for (const ev of USER_SCROLL_EVENTS)
			window.addEventListener(ev, cancelSlowScroll, { passive: true });
		stopUserWatch = () => {
			for (const ev of USER_SCROLL_EVENTS) window.removeEventListener(ev, cancelSlowScroll);
		};

		const step = (/** @type {number} */ now) => {
			const p = Math.min(1, (now - start) / duration);
			window.scrollTo(0, from + (targetTop() - from) * easeInOutCubic(p));
			if (p < 1) scrollRaf = requestAnimationFrame(step);
			else cancelSlowScroll();
		};
		scrollRaf = requestAnimationFrame(step);
	}

	/* איתור לפי id ולא ב-bind:this: הבלוק חי בשני מקומות שונים בדף (מיד מתחת
	   למסילה כשמסננים, ובתחתית כשלא), ורק אחד מהם קיים בכל רגע — הפניה חיה
	   עלולה להתאפס בדיוק ברגע המעבר. */
	function scrollToResults() {
		const el = document.getElementById('results');
		if (el) slowScrollTo(el);
	}

	/** מעבר אל כלל בעלי המקצוע — מנקה סינון פעיל כדי שהרשימה תהיה באמת "הכל" */
	async function goToAllBusinesses() {
		clearFilters();
		visibleCount = 9;
		await tick();
		scrollToResults();
	}

	/** בחירת תחום מהמסילה — מסננת, והתוצאות נפתחות מיד מתחת למסילה
	 *  @param {string} key */
	async function pickCategory(key) {
		selectedCategory = key || 'all';
		visibleCount = 9;
		// הבחירה נרשמת גם ל-sessionStorage: כפתור "הוסף עסק" שבכותרת הוא קישור
		// סטטי שאינו נושא את התחום, וטופס ההגשה קורא משם את ברירת המחדל
		// (ראו $lib/lastCategory). ביטול הסינון מוחק את הרישום.
		rememberCategory(key);
		await tick();
		// לחיצה חוזרת על תחום נבחר מבטלת את הסינון; אז בלוק התוצאות חוזר
		// לתחתית הדף, וגלילה אליו הייתה זורקת את המשתמש הרחק מהמסילה
		if (key) scrollToResults();
	}

	/* ═══════════ ערים ═══════════
	   הבורר נבנה מכל עיר שנרשמה על כרטיסייה — שדה "עיר" של הטופס, ובנוסף
	   מה שנסרק מהכתובת ומאזור השירות ($lib/cities.js). נגזר פעם אחת לכל
	   כרטיסייה ונשמר במפה: הסינון קורא ממנה בכל הקלדה בחיפוש, וסריקה
	   חוזרת של כל הכתובות בכל תו הייתה מיותרת. */
	const cityIndex = $derived(new Map(businesses.map((b) => [b.id, businessCities(b)])));
	const cities = $derived(
		[...new Set([...cityIndex.values()].flatMap((s) => [...s]))].sort((a, b) =>
			a.localeCompare(b, 'he')
		)
	);

	// חיפוש על שדות רלוונטיים בלבד (לא על כל אובייקט כולל URL של תמונות).
	// subcategory ("תת-קטגוריה / פירוט") הוא בדיוק המקום שבו עסק כותב את שם
	// המקצוע שלו במילים של הגולש, ולכן הוא חלק מהחיפוש. tags הן המילים
	// הנוספות שהוא רשם בדיוק למטרה הזאת (ראו $lib/tags.js).
	const SEARCH_FIELDS = [
		'name',
		'category',
		'subcategory',
		'tags',
		'description',
		'discount',
		'address',
		'salesArea'
	];
	/** ערך שדה כטקסט — התגיות מגיעות כמערך, ורווח מפריד ביניהן ולא פסיק:
	 *  אחרת ביטוי חיפוש היה נופל על התפר שבין שתי תגיות. @param {unknown} v */
	const fieldText = (v) => (Array.isArray(v) ? v.join(' ') : String(v || ''));
	/** @param {any} b */
	function matchesSearch(b) {
		if (!searchTerm) return true;
		const q = searchTerm.toLowerCase();
		return SEARCH_FIELDS.some((f) => fieldText(b[f]).toLowerCase().includes(q));
	}

	// ה-API כבר מחזיר מהחדש לישן (createdAt:desc) — אין צורך להפוך (ה-reverse היה שריד מ-Google Sheets)
	const filteredBusinesses = $derived(
		businesses.filter((b) => {
			const okCat = selectedCategory === 'all' || b.category === selectedCategory;
			// אותו מקור בדיוק שממנו נבנה הבורר ⇒ עיר שאפשר לבחור תמיד מחזירה תוצאות
			const okLoc = selectedLocation === 'all' || !!cityIndex.get(b.id)?.has(selectedLocation);
			return matchesSearch(b) && okCat && okLoc;
		})
	);

	const displayedBusinesses = $derived(filteredBusinesses.slice(0, visibleCount));

	/* ═══════════ "לא נמצא — אבל אלה הקרובים" ═══════════
	   חיפוש שהחזיר אפס תוצאות מקבל את העסקים הקרובים ביותר לתחום שהוקלד
	   (ראו $lib/searchSuggest): התאמת שורש למילת החיפוש, ובנוסף התחום שאליו
	   היא שייכת לפי מילות המפתח של הטקסונומיה — כך ש"שרברב" מחזיר את אנשי
	   הבית והתחזוקה גם כשאף כרטיסייה לא כתבה את המילה הזאת.
	   קודם בתוך הסינון שהגולש בחר (תחום/עיר), כדי לא לסתור אותו; רק אם שם
	   אין אף מועמד — מכל האינדקס, כי הצעה רחוקה עדיפה על דף ריק. */
	const suggestedBusinesses = $derived.by(() => {
		if (!searchTerm.trim() || filteredBusinesses.length > 0) return [];
		const inFilters = businesses.filter((b) => {
			const okCat = selectedCategory === 'all' || b.category === selectedCategory;
			const okLoc = selectedLocation === 'all' || !!cityIndex.get(b.id)?.has(selectedLocation);
			return okCat && okLoc;
		});
		const near = suggestForQuery(searchTerm, inFilters);
		return near.length ? near : suggestForQuery(searchTerm, businesses);
	});

	/* ═══════════ מה חיפשו כאן ═══════════
	   שורת החיפוש היא המקום היחיד שבו הגולש אומר במילים שלו מה הוא רוצה,
	   וכל הקלדה שם נזרקה עד היום. הרישום מושהה ונשלח פעם אחת לכל חיפוש
	   (ראו $lib/searchTrack), ומצורף אליו מספר התוצאות: ביטוי מבוקש שחוזר
	   עם דף ריק הוא רשימת בעלי המקצוע שכדאי לגייס.
	   $effect רץ בדפדפן בלבד, ולכן אין כאן רישום מצד השרת. */
	$effect(() => {
		trackSearch(searchTerm, filteredBusinesses.length);
	});

	/* סינון פעיל (מסילת התחומים / חיפוש / עיר) הופך את הדף למצב "תוצאות":
	   הקומות הקבועות מתחלפות ברשימת העסקים הרלוונטיים, מיד מתחת למסילה. */
	const isFiltering = $derived(
		Boolean(searchTerm) || selectedCategory !== 'all' || selectedLocation !== 'all'
	);

	/* קיצור הדרך "יש לכם עסק בתחום הזה?" — מופיע בתוך התחום שנבחר, ולכן הוא
	   נושא אותו איתו: טופס ההגשה מקבל את התחום בשאילתה ומסמן אותו כברירת מחדל,
	   כדי שמי שהגיע מהתחום לא יחפש אותו שוב ברשימה. */
	const submitHref = $derived(
		selectedCategory === 'all'
			? '/submit-business'
			: `/submit-business?category=${encodeURIComponent(selectedCategory)}`
	);

	// המדורגים ביותר — רק אם קיימים דירוגים אמיתיים (אחרת אין "מדורגים", זה חירטוט)
	const ratedBusinesses = $derived(
		[...filteredBusinesses].filter((b) => b.rating > 0).sort((a, b) => b.rating - a.rating)
	);
	let showAllRated = $state(false);
	const topRated = $derived(showAllRated ? ratedBusinesses : ratedBusinesses.slice(0, 3));

	// שנתווספו לאחרונה — ה-API מחזיר createdAt:desc, ולכן ראש הרשימה הוא החדש
	const recentBusinesses = $derived(filteredBusinesses.slice(0, 3));

	/* הקומה התחתונה "לכלל ההטבות והעסקים" — בלי הכרטיסים שכבר מוצגים בקומות
	   שמעל (מדורגים/שנתווספו): כל הרשימות נגזרות מאותו מיון, ובלי הסינון הזה
	   שלושת הכרטיסים הראשונים הופיעו פעמיים ברצף על אותו מסך. */
	const allFloorBusinesses = $derived.by(() => {
		const above = new Set([...topRated, ...recentBusinesses].map((b) => b.id));
		return filteredBusinesses.filter((b) => !above.has(b.id)).slice(0, visibleCount);
	});

	const favoriteBusinesses = $derived(businesses.filter((b) => $favorites.includes(b.id)));

	function clearFilters() {
		selectedCategory = 'all';
		selectedLocation = 'all';
		searchTerm = '';
		rememberCategory(''); // יצא מהתחום — הטופס לא יציע תחום שכבר נעזב
	}

	/* ═══════════ SEO ═══════════
	   דף הבית הוא דף הכניסה המרכזי מגוגל וממנועי ה-AI: כותרת ותיאור מלאים,
	   canonical, JSON-LD (WebSite, Organization, Service, ItemList של כל
	   בעלי המקצוע, FAQ), וכן אינדקס טקסטואלי מלא בתחתית הדף שמקשר לכל עסק. */
	const pageTitle = `בעלי מקצוע מומלצים ומדורגים בכל הארץ | ${SITE_NAME}`;

	/* ═══════════ שאר בעלי המקצוע ═══════════
	   עד כאן ישבה כאן טבלה שריכזה את כל 92 בעלי המקצוע. עכשיו במקומה יושבים
	   הכרטיסים של מי שלא הופיע באף קומה למעלה, מחולקים לעמודים.

	   כל העמודים מרונדרים תמיד ב-HTML ורק הלא-נוכחיים מוסתרים ב-CSS (ולא
	   ב-{#if}) — זו הסיבה שהרשימה הזו נולדה מלכתחילה: היא הקישור הפנימי היחיד
	   לרוב העסקים, והכרטיסים למעלה מוצגים 9 בלבד. הסרה מה-DOM הייתה מנתקת
	   עשרות עסקים מהסריקה של גוגל ומנועי ה-AI. התמונות נטענות ב-loading="lazy",
	   ולכן עמודים מוסתרים לא מושכים בייטים. */
	let showRest = $state(false);
	let restPage = $state(0);

	/* 18 בעמוד: שש שורות של שלושה בדסקטופ, תשע שורות של שניים בנייד — בערך
	   מסך מלא אחרי שהפרסומות לוקחות את חלקן, ומתחלק בלי שארית בשתי הפריסות. */
	const REST_PAGE_SIZE = 18;

	// "שאר" = מי שלא מוצג באף אחת מהקומות שמעל (מדורגים / שנתווספו / כלל העסקים),
	// כדי שהמשתמש לא יפגוש כאן שוב את אותם כרטיסים שכבר גלל דרכם.
	// במצב סינון הרשימה המוצגת היא displayedBusinesses; בלעדיו — allFloorBusinesses.
	const shownAbove = $derived(
		new Set(
			[
				...topRated,
				...recentBusinesses,
				...(isFiltering ? displayedBusinesses : allFloorBusinesses)
			].map((b) => b.id)
		)
	);
	const restBusinesses = $derived(businesses.filter((b) => !shownAbove.has(b.id)));

	const restPageCount = $derived(Math.max(1, Math.ceil(restBusinesses.length / REST_PAGE_SIZE)));
	const restPages = $derived(
		Array.from({ length: restPageCount }, (_, i) =>
			restBusinesses.slice(i * REST_PAGE_SIZE, (i + 1) * REST_PAGE_SIZE)
		)
	);
	// נגזר ולא מתוקן ב-$effect: מספר העמודים מתכווץ כשנפתחים "המדורגים ביותר",
	// והצמדה בתוך אפקט הייתה כותבת למצב שהיא עצמה קוראת
	const currentRestPage = $derived(Math.min(restPage, restPageCount - 1));

	/* חלון מספרי העמודים: עד 7 עמודים מציגים הכל, ומעבר לזה רק ראשון, אחרון
	   והשכנים של הנוכחי — אחרת שורת העמודים נשברת לשתי שורות ככל שהאינדקס גדל */
	const restPageNumbers = $derived.by(() => {
		if (restPageCount <= 7) return Array.from({ length: restPageCount }, (_, i) => i);
		const near = [0, restPageCount - 1, currentRestPage - 1, currentRestPage, currentRestPage + 1];
		return [...new Set(near)].filter((n) => n >= 0 && n < restPageCount).sort((a, b) => a - b);
	});

	/** @param {number} page */
	function goToRestPage(page) {
		restPage = Math.min(Math.max(page, 0), restPageCount - 1);
		// גלילה חזרה לראש הבלוק: בלעדיה מעבר עמוד משאיר את המשתמש בתחתית
		// הרשימה הקודמת, מול כרטיסים שהתחלפו מתחתיו בלי שיראה את זה
		const el = document.getElementById('rest-professionals');
		if (!el) return;
		const header = document.querySelector('header');
		const top =
			el.getBoundingClientRect().top + window.scrollY - ((header?.offsetHeight ?? 0) + 12);
		window.scrollTo({
			top: Math.max(0, top),
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
		});
	}

	// ה-FAQPage אינו כאן יותר: ההסבר והשאלות הנפוצות עברו ללשונית "אודות"
	// שבדף המידע (/policy), והסכימה נדדה לשם — גוגל דורש שהסכימה תשקף טקסט
	// שגלוי בפועל באותו עמוד.
	const schemas = $derived([
		websiteSchema(),
		organizationSchema(),
		serviceSchema(),
		collectionSchema({
			name: `${SITE_NAME} — אינדקס בעלי המקצוע`,
			description: SITE_DESCRIPTION,
			path: '/',
			numberOfItems: businesses.length,
			items: businesses.map((b) => ({ name: b.name, path: `/business/${b.id}` }))
		})
	]);
</script>

<Seo
	title={pageTitle}
	description={SITE_DESCRIPTION}
	path="/"
	keywords="בעלי מקצוע, בעל מקצוע מומלץ, אינדקס בעלי מקצוע, חשמלאי, אינסטלטור, שיפוצניק, מזגנים, הובלות, מחשבים, עורך דין, בייביסיטר, דירוג בעלי מקצוע, המלצות"
/>
<JsonLd data={schemas} />

<div class="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
	<!-- H1 — הכותרת הראשית של הדף. עד כאן לא היה בדף אף h1, וגוגל לא ידע במה הדף עוסק.
	     בנייד הכותרת קטנה: מתחתיה יושבים החיפוש והמפה זה לצד זה, וכותרת בשלוש
	     שורות דחפה אותם למטה. -->
	<h1 class="mb-3 text-center text-lg font-extrabold text-gray-100 sm:mb-8 sm:text-4xl">
		בעלי מקצוע כשירים ומומלצים בהטבות והנחות בלעדיות לחברי יוצאים לחירות
	</h1>

	{#if error}
		<div class="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
			<p class="text-red-400">{t.error}: {error}</p>
		</div>
	{:else}
		<!-- ═══ שורת הפתיחה: חיפוש ומפה זה לצד זה ═══
		     המפה עלתה לכאן מלמטה (עד כאן ישבה מתחת למסילת התחומים) ותופסת חצי
		     רוחב בלבד — כך גם החיפוש אינו נמתח לכל רוחב המסך, ושניהם נראים יחד
		     בלי גלילה. הפריסה הזאת נשמרת גם בנייד — חיפוש מימין, מפה משמאל —
		     במקום קיפול מאחורי כפתור: שתי עמודות צרות עולות פחות גובה מאשר
		     שני בלוקים ברוחב מלא זה מעל זה, והמפה נראית בלי לחיצה.
		     items-center: המפה גבוהה מבלוק החיפוש, וכשהחיפוש נצמד לראש השורה
		     נפער מתחתיו חלל ריק — מרכוז אנכי מיישר אותו לאמצע המפה. -->
		<div class="mb-2 grid grid-cols-2 items-center gap-3 md:mb-8 md:gap-6">
			<!-- Filters -->
			<div class="space-y-2 md:space-y-3">
				<!-- החיפוש ובורר העיר: שניהם מצמצמים את אותה רשימה, ולכן הם צמודים.
				     בדסקטופ באותה שורה — השדה נמתח והבורר ברוחב תוכנו; בנייד, בתוך
				     חצי רוחב מסך, שורה אחת הייתה מוחצת את שדה החיפוש, ולכן הם נערמים. -->
				<div class="flex flex-col gap-2 md:flex-row md:items-center">
					<div class="relative flex-1">
						<input
							type="text"
							bind:value={searchTerm}
							placeholder={t.search}
							aria-label={t.search}
							class="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 pr-9 text-sm text-gray-100 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900/30 md:px-4 md:py-3 md:pr-12 md:text-base"
						/>
						<svg
							class="absolute top-3 right-3 h-4 w-4 text-gray-400 md:top-3.5 md:right-4 md:h-5 md:w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>

					{#if cities.length > 0}
						<select
							bind:value={selectedLocation}
							aria-label="עיר"
							class="w-full flex-shrink-0 rounded-xl border border-gray-700 bg-purple-600 px-3 py-2.5 text-sm font-bold text-white outline-none md:w-auto md:max-w-[45%] md:px-4 md:py-3"
						>
							<option value="all">כל הארץ</option>
							{#each cities as city}
								<option value={city}>{city}</option>
							{/each}
						</select>
					{/if}
				</div>

				<div
					class="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-gray-400 md:text-sm"
				>
					<span>{t.totalBusinesses.replace('{count}', businesses.length.toString())}</span>
					{#if searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'}
						<span class="text-gray-700">|</span>
						<span class="font-medium text-blue-400"
							>{t.foundResults.replace('{count}', filteredBusinesses.length.toString())}</span
						>
						<button
							onclick={clearFilters}
							class="font-medium text-gray-400 underline-offset-2 hover:text-blue-400 hover:underline"
						>
							ביטול כל המסננים
						</button>
					{/if}
				</div>
			</div>

			<!-- מפה — מציגה תמיד את התוצאות המסוננות, ולכן חיפוש או בחירת תחום
			     מצטיירים גם עליה. גם בנייד היא פרוסה כאן, בעמודה שמשמאל לחיפוש. -->
			<div>
				<LazyMap businesses={filteredBusinesses} />
			</div>
		</div>

		<!-- מסילת התחומים — המסנן הראשי לפי תחום, במקום תפריט נפתח שהסתיר
		     את התחומים עד שנוגעים בו. כל אריח נושא את מספר העסקים שבו. -->
		{#if railCategories.length > 1}
			<CategoryRail
				categories={railCategories}
				selected={selectedCategory === 'all' ? '' : selectedCategory}
				onselect={pickCategory}
			/>
		{/if}

		<!-- גוף רשימת התוצאות — מוגדר פעם אחת ומרונדר במקום אחד בכל רגע:
		     מיד מתחת למסילה כשיש סינון פעיל (עם displayedBusinesses), ובתחתית
		     הדף כשאין (עם allFloorBusinesses, בלי מה שכבר הוצג בקומות שמעל).
		     withLoadMore: ברשימה התחתונה הכרטיסים הם מדגם, והדרך לראות את כולם
		     היא הטבלה שמתחתיה — ולכן "טען עוד" מופיע רק במצב סינון, שם רשימה
		     קטועה בלי המשך היא תוצאה חסרה. -->
		{#snippet resultsBody(/** @type {any[]} */ list, withLoadMore = false)}
			<div class="cards-grid">
				{#each list as business (business.id)}
					<BusinessCard {business} />
				{/each}
			</div>

			{#if filteredBusinesses.length === 0}
				<!-- אריח של תחום ריק מוביל לכאן, ואז "לא נמצאו... לחיפוש" מטעה: לא
				     חיפשו כלום, פשוט אין עדיין עסקים בתחום -->
				{#if selectedCategory !== 'all' && !searchTerm && selectedLocation === 'all'}
					<p class="mt-8 text-center text-gray-400">
						עדיין אין עסקים בתחום הזה. יש לכם עסק מתאים?
						<a href={submitHref} class="font-semibold text-blue-400 hover:text-blue-300"
							>הוסיפו אותו לאינדקס</a
						>
					</p>
				{:else if suggestedBusinesses.length > 0}
					<!-- דף ריק הוא סוף הביקור. מי שחיפש מקצוע שאין לו התאמה מדויקת
					     מקבל כאן את העסקים הקרובים לתחום שביקש, ולא רק הודעת "לא נמצא". -->
					<div class="mt-8">
						<p class="text-center text-base font-bold text-gray-200">
							לא מצאנו עסק שתואם בדיוק ל"{searchTerm}"
						</p>
						<p class="mt-1 text-center text-sm text-gray-400">
							אלה העסקים הקרובים ביותר לתחום שחיפשתם:
						</p>
						<div class="cards-grid mt-6">
							{#each suggestedBusinesses as business (business.id)}
								<BusinessCard {business} />
							{/each}
						</div>
						<p class="mt-6 text-center text-sm text-gray-400">
							לא זה מה שחיפשתם? יש לכם עסק בתחום?
							<a href="/submit-business" class="font-semibold text-blue-400 hover:text-blue-300"
								>הוסיפו אותו לאינדקס</a
							>
						</p>
					</div>
				{:else}
					<p class="mt-8 text-center text-gray-400">לא נמצאו עסקים התואמים לחיפוש.</p>
				{/if}
			{/if}

			{#if withLoadMore && visibleCount < filteredBusinesses.length}
				<div class="mt-8 flex justify-center md:mt-12">
					<button
						onclick={loadMore}
						class="rounded-full bg-gray-800 px-8 py-3 text-lg font-bold text-blue-400 shadow-md transition hover:bg-gray-700 active:scale-95"
					>
						{t.loadMore.replace('{count}', (filteredBusinesses.length - visibleCount).toString())}
					</button>
				</div>
			{/if}
		{/snippet}

		{#if isFiltering}
			<!-- מצב תוצאות: מי שבחר תחום במסילה (או חיפש/בחר עיר) מקבל את
			     העסקים הרלוונטיים כאן ועכשיו, ולא מתחת לקומות ולמפה. -->
			<!-- כותרת התוצאות ולצדה קיצור הדרך להגשת עסק באותו תחום. רשת של שלוש
			     עמודות ולא מיקום אבסולוטי: הכותרת נשארת ממורכזת, והקיצור לעולם
			     לא נוחת עליה בשמות תחום ארוכים. בנייד הוא יורד לשורה משלו. -->
			<div id="results" class="mt-6 mb-8 md:mb-16">
				<div class="mb-4 md:mb-8 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
					<div class="hidden md:block"></div>
					<div class="text-center">
						<h2
							class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-xl font-extrabold text-transparent sm:text-4xl"
						>
							{selectedCategory === 'all' ? t.filterResultsTitle : selectedCategory}
						</h2>
						<p class="mt-2 text-sm text-gray-400">
							{t.foundResults.replace('{count}', filteredBusinesses.length.toString())}
						</p>
					</div>
					{#if selectedCategory !== 'all'}
						<div class="mt-3 flex justify-center md:mt-0 md:justify-end">
							<a
								href={submitHref}
								aria-label="הוספת עסק לאינדקס בתחום {selectedCategory}"
								class="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-600/10 px-4 py-2 text-xs font-bold text-blue-300 transition hover:border-blue-400/70 hover:bg-blue-600/20 hover:text-blue-200 active:scale-95 md:text-sm"
							>
								<span aria-hidden="true">＋</span>
								<span>יש לכם עסק בתחום הזה?</span>
							</a>
						</div>
					{/if}
				</div>

				{@render resultsBody(displayedBusinesses, true)}

				<div class="mt-6 flex justify-center md:mt-10">
					<button
						onclick={goToAllBusinesses}
						class="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300"
					>
						{t.allProfessionals}
					</button>
				</div>
			</div>
		{:else}
			<!-- קומה 1: המדורגים ביותר (רק כשיש דירוגים אמיתיים) -->
			{#if topRated.length > 0}
				<div class="mt-6 mb-8 md:mb-16">
					<div class="mb-4 text-center md:mb-8">
						<h2
							class="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-xl font-extrabold text-transparent sm:text-4xl"
						>
							{t.topRated}
						</h2>
					</div>
					<div class="cards-grid">
						{#each topRated as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
					{#if ratedBusinesses.length > 3}
						<div class="mt-8 flex justify-center">
							<button
								onclick={() => (showAllRated = !showAllRated)}
								class="rounded-full border border-gray-700 px-6 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300"
							>
								{showAllRated ? t.showLess : t.moreTopRated}
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<!-- קומה 2: בעלי מקצוע שנתווספו לאחרונה -->
			{#if recentBusinesses.length > 0}
				<!-- mt-6 כמו בקומה 1: כשאין דירוגים זו הקומה הראשונה, והיא נצמדה למסילה -->
				<div class="mt-6 mb-8 md:mb-16">
					<div class="mb-4 text-center md:mb-8">
						<h2
							class="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-xl font-extrabold text-transparent sm:text-4xl"
						>
							{t.newBusinesses}
						</h2>
					</div>
					<div class="cards-grid">
						{#each recentBusinesses as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Favorites -->
			{#if favoriteBusinesses.length > 0}
				<div class="mb-8 md:mb-16">
					<div class="mb-4 flex items-center gap-3 md:mb-8">
						<div class="h-8 w-1.5 rounded-full bg-red-500"></div>
						<h2 class="text-xl font-bold text-gray-100 sm:text-2xl">{t.favorites}</h2>
					</div>
					<div class="cards-grid">
						{#each favoriteBusinesses as business (business.id)}
							<BusinessCard {business} />
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- All businesses — יעד הכפתור "לכלל בעלי המקצוע והעסקים".
		     allFloorBusinesses ריק כשכל העסקים כבר מוצגים בקומות שמעל —
		     ואז אין מה להציג וגם לא כותרת יתומה. -->
		{#if !isFiltering && allFloorBusinesses.length > 0}
			<div id="results" class="mt-8 md:mt-16">
				<div class="mb-4 text-center md:mb-8">
					<h2
						class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-xl font-extrabold text-transparent sm:text-4xl"
					>
						{t.allBusinesses}
					</h2>
				</div>

				{@render resultsBody(allFloorBusinesses)}
			</div>
		{/if}

		<!-- ═══ שאר בעלי המקצוע ═══
		     הכרטיסים למעלה מוצגים 9 בלבד, ולכן בלי הבלוק הזה רוב העסקים אינם
		     מקושרים ב-HTML הראשון. כל העמודים יושבים ב-HTML וגוגל מגלה דרכם כל
		     עסק ועסק — אבל הבלוק סגור עד שלוחצים, כדי שלא יתפוס מסך שלם בתחתית
		     דף הבית. hidden ב-CSS ולא {#if}: התוכן חייב להישאר ב-HTML הראשון. -->
		{#if restBusinesses.length > 0}
			<section
				id="rest-professionals"
				class="mt-10 border-t border-gray-800 pt-6 md:mt-20 md:pt-10"
				aria-labelledby="rest-title"
			>
				<div class="text-center">
					<!-- המספר חי: businesses.length נגזר מהרשימה שמגיעה מהשרת, ולכן
					     הוא מתעדכן מאליו עם כל בעל מקצוע שמתווסף לאתר. -->
					<h2
						id="rest-title"
						class="mb-5 bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-xl font-extrabold text-transparent sm:text-4xl"
					>
						לכלל {businesses.length} בעלי המקצוע באתר
					</h2>

					<button
						type="button"
						onclick={() => (showRest = !showRest)}
						aria-expanded={showRest}
						aria-controls="rest-list"
						class="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 px-6 py-3 text-sm font-black text-blue-200 shadow-lg transition-all hover:border-blue-400/70 hover:from-blue-900/70 hover:to-indigo-900/70 active:scale-95"
					>
						<span aria-hidden="true">👷</span>
						{showRest ? 'סגירת הרשימה' : 'הצגת שאר בעלי המקצוע'}
						<span class="text-xs" aria-hidden="true">{showRest ? '▲' : '▼'}</span>
					</button>
				</div>

				<div id="rest-list" class="mt-8" class:hidden={!showRest}>
					<!-- ההסתרה יושבת על עטיפה נטולת מחלקות-display: על הרשת עצמה
					     היא הייתה מפסידה ל-md:grid, שגובר על hidden בברייקפוינט -->
					{#each restPages as page, i (i)}
						<div class:hidden={i !== currentRestPage}>
							<div class="cards-grid">
								{#each page as business (business.id)}
									<BusinessCard {business} />
								{/each}
							</div>
						</div>
					{/each}

					{#if restPageCount > 1}
						<nav
							class="mt-10 flex flex-wrap items-center justify-center gap-2"
							aria-label="עמודי בעלי המקצוע"
						>
							<button
								type="button"
								onclick={() => goToRestPage(currentRestPage - 1)}
								disabled={currentRestPage === 0}
								class="rounded-full border border-gray-700 px-4 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700"
							>
								הקודם
							</button>

							{#each restPageNumbers as n, idx (n)}
								{#if idx > 0 && n - restPageNumbers[idx - 1] > 1}
									<span class="px-1 text-gray-600" aria-hidden="true">…</span>
								{/if}
								<button
									type="button"
									onclick={() => goToRestPage(n)}
									aria-current={n === currentRestPage ? 'page' : undefined}
									class="min-w-11 rounded-full border px-3 py-2.5 text-sm font-bold tabular-nums transition {n ===
									currentRestPage
										? 'border-blue-400 bg-blue-900/50 text-blue-100'
										: 'border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-300'}"
								>
									{n + 1}
								</button>
							{/each}

							<button
								type="button"
								onclick={() => goToRestPage(currentRestPage + 1)}
								disabled={currentRestPage >= restPageCount - 1}
								class="rounded-full border border-gray-700 px-4 py-2.5 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700"
							>
								הבא
							</button>
						</nav>

						<p class="mt-4 text-center text-xs text-gray-400">
							עמוד {currentRestPage + 1} מתוך {restPageCount}
						</p>
					{/if}
				</div>
			</section>
		{/if}
	{/if}

	<!-- ההסבר "איך זה עובד" והשאלות הנפוצות עברו ללשונית "אודות" שבדף המידע
	     (/policy, וגם בחלון שנפתח מכפתור "מידע" שבכותרת), כדי שכל המידע על
	     האתר יישב במקום אחד. הקישור לשם יושב בכותרת, בכל דף. -->
</div>

<style>
	/* רשת הכרטיסים: זוגות בנייד, שלשות מדסקטופ. רשת ולא flex-wrap ממורכז —
	   כרטיס אחרון יתום צף שם לבדו במרכז ונקרא כשבירת פריסה; כאן הוא נמתח
	   לכל הרוחב, ובדסקטופ (שלוש עמודות) חוזר לרוחב עמודה רגיל. */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	/* הילדים הם קומפוננטות (BusinessCard) ולכן :global — הסקופינג של Svelte
	   לא מגיע אל תוכן. */
	.cards-grid > :global(:last-child:nth-child(odd)) {
		grid-column: 1 / -1;
	}
	@media (min-width: 768px) {
		.cards-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 1.5rem;
		}
		.cards-grid > :global(:last-child:nth-child(odd)) {
			grid-column: auto;
		}
	}
</style>
