<script>
	import { lang, translations } from '$lib/i18n';
	import { favorites, toggleFavorite as toggleFav } from '$lib/favorites.js';
	import { imgUrl, imgSrcSet, imgFallback } from '$lib/img.js';
	import { adImgFit } from '$lib/adImageFit';
	import { parseFit, isDefaultFit } from '$lib/mediaFit.js';
	import StarRating from './StarRating.svelte';
	import ShareButton from './ShareButton.svelte';

	let { business } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const isFavorite = $derived($favorites.includes(business.id));

	/** @param {MouseEvent} e */
	function toggleFavorite(e) {
		e.preventDefault();
		toggleFav(business.id);
	}

	/* התמונה מוגשת דרך ממטב התמונות ($lib/img.js): המקור הוא לרוב קובץ של
	   מגה-בייטים, והמשבצת כאן היא ~160px. כפול תשעים כרטיסיות זה ההבדל בין
	   דף שנפתח לדף שנטען.
	   הכישלון הוא בשני שלבים: כישלון ראשון = הממטב לא זמין ⇒ imgFallback
	   מנסה בכתובת המקורית; כישלון שני (הכתובת שנוסתה היא כבר המקורית) =
	   אין תמונה ⇒ מונוגרם. */
	let failedImage = $state(false);

	// יש עסקים שלא העלו תמונות אבל כן העלו לוגו. במקום אות בודדת על ריבוע
	// ריק — הלוגו עצמו ממלא את אזור המדיה, בלי חיתוך (object-contain): לוגו
	// שנחתך לרוחב האריח קורא כמו תקלה. המונוגרם נשאר למי שאין לו גם לוגו.
	const cardImage = $derived(business.banner || business.logo || '');
	const isLogoOnly = $derived(!business.banner && !!business.logo);

	/** @param {Event} e */
	function onBannerError(e) {
		const img = /** @type {HTMLImageElement} */ (e.currentTarget);
		if (img.src === new URL(cardImage, location.href).href) failedImage = true;
	}

	// מיקום וזום שנקבעו בעורך. כשהם ברירת המחדל הפעולה מכובה לגמרי,
	// והמראה נשאר בדיוק כפי שה-class מגדיר (ראו mediaFit.js).
	// business.banner הוא כבר התמונה הראשית שבחר בעל העסק — והמיקום שנלקח
	// כאן הוא המיקום שלה, ולא של הראשונה שהועלתה (ראו mediaFit.js).
	// כשהמוצג הוא הלוגו — המיקום שלו הוא זה שנקבע לו בעורך הלוגו.
	const cardFit = $derived(
		isLogoOnly
			? parseFit(business.logo_fit)
			: parseFit(business.banner_fits?.[business.main_index ?? 0])
	);

	// הדירוג בכרטיסייה — רק כשיש דירוג אמיתי (כמו בקומת "המדורגים ביותר"),
	// ולא חמישה כוכבים כבויים בכל כרטיס. הממוצע מעוגל לספרה אחת.
	const ratingCount = $derived(Number(business.ratingCount || 0));
	const rating = $derived(Math.round(Number(business.rating || 0) * 10) / 10);
</script>

<!-- הרוחב נקבע ע"י רשת הכרטיסים בדף (cards-grid), לא כאן -->
<div
	class="group relative flex flex-col overflow-hidden rounded-xl border border-blue-800/60 bg-blue-950 transition-colors duration-200 hover:border-blue-500"
>
	<!-- שכבת המגע (before:-inset-2) מרחיבה את יעד ההקשה ל~44px בלי לשנות את
	     הוויזואל: הכפתור הנראה 28px, וכל החטאה קלה פתחה את דף העסק במקום
	     לסמן מועדף. -->
	<button
		onclick={toggleFavorite}
		class="absolute top-2 left-2 z-30 rounded-full bg-black/30 p-1.5 backdrop-blur-sm transition before:absolute before:-inset-2 before:content-[''] hover:bg-black/60"
		aria-label={isFavorite ? t.removeFromFavorites : t.saveToFavorites}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4 {isFavorite ? 'fill-red-500 stroke-red-500' : 'stroke-gray-300'}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path
				d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
			></path>
		</svg>
	</button>

	<!-- קיצור השיתוף — בפינה התחתונה, על הרקע הכהה ולא על התמונה: מעל
	     התמונה הוא נבלע בה ולא נראה בכלל. הוא יושב מחוץ ל-<a> (כפתור בתוך
	     קישור הוא HTML לא חוקי), ולכן מוצב אבסולוטית ולא בזרימת הטקסט;
	     שורת הכתובת שומרת לו מקום ב-pl-9. -->
	<div class="absolute bottom-2 left-2 z-30">
		<ShareButton
			path="/business/{business.id}"
			title={business.name}
			text={business.slogan || business.category || business.name}
		/>
	</div>

	<a href="/business/{business.id}" class="flex flex-1 flex-col">
		<!-- אזור המדיה: התמונה שבעל העסק בחר כראשית — בלי הלוגו מעליה. כשאין
		     תמונה כזו אבל יש לוגו — הלוגו במקומה; וכשאין גם לוגו — מונוגרם
		     שקט במקום ריבוע ריק. -->
		<div class="relative h-24 w-full overflow-hidden bg-black/25 sm:h-40">
			{#if cardImage && !failedImage}
				<!-- העוטף הוא משבצת המדידה של adImgFit, ולכן השוליים של הלוגו
				     נקבעים בו (inset) ולא ב-padding של התמונה. -->
				<div class="absolute {isLogoOnly ? 'inset-3 sm:inset-5' : 'inset-0'}">
					<img
						src={imgUrl(cardImage, 384)}
						srcset={imgSrcSet(cardImage, [256, 384, 640])}
						sizes="(min-width: 640px) 20rem, 50vw"
						alt={business.name}
						class="absolute inset-0 h-full w-full {isLogoOnly ? 'object-contain' : 'object-cover'}"
						loading="lazy"
						decoding="async"
						onerror={onBannerError}
						use:imgFallback={cardImage}
						use:adImgFit={{
							...cardFit,
							mode: isLogoOnly ? 'contain' : 'cover',
							enabled: !isDefaultFit(cardFit)
						}}
					/>
				</div>
			{:else}
				<span
					class="absolute inset-0 z-10 flex items-center justify-center text-2xl font-bold text-blue-300/40 sm:text-4xl"
					aria-hidden="true"
				>
					{(business.name || '').trim().charAt(0)}
				</span>
			{/if}
		</div>

		<div class="flex flex-1 flex-col p-3 sm:p-4">
			<!-- בנייד השם בשתי שורות (הכרטיס צר והשמות נחתכו באמצע), עם גובה
			     מינימלי כדי ששורות הרשת יישארו מיושרות; בדסקטופ שורה אחת כתמיד.
			     שאר הטקסט עלה מ-10px — מתחת לסף הקריאוּת — ל-12px. -->
			<h3
				class="line-clamp-2 min-h-10 text-sm font-semibold text-gray-100 transition-colors group-hover:text-white sm:line-clamp-1 sm:min-h-0 sm:text-base"
			>
				{business.name}
			</h3>

			<!-- הציון והכוכבים בלבד. מספר המדרגים ("(1)") ירד מהכרטיס: בעסק שרק
			     התחיל להיות מדורג הוא קרא כמו הסתייגות מהציון עצמו. הוא נשאר
			     בדף העסק, לצד חוות הדעת שמאחוריו. -->
			{#if ratingCount > 0}
				<div class="mt-1 flex items-center gap-1.5">
					<StarRating
						value={rating}
						size="sm"
						label={t.ratingOutOf5.replace('{rating}', String(rating))}
					/>
					<span class="text-xs font-medium text-gray-200">{rating}</span>
				</div>
			{/if}

			{#if business.slogan}
				<p class="mt-1 line-clamp-2 text-xs leading-tight text-gray-300">
					{business.slogan}
				</p>
			{/if}

			<!-- ההטבה: הערך לבדו ("15%") הוא מספר בלי משמעות, ולכן תמיד עם
			     הכיתוב שמסביר מה הוא — 🎁 15% הנחה לנו -->
			{#if business.discount}
				<p class="mt-2 line-clamp-2 text-xs leading-tight font-medium text-emerald-400">
					🎁 {business.discount}
					{t.benefitShort}
				</p>
			{/if}

			<div class="mt-auto flex items-center gap-1.5 pt-2 pl-9 text-xs text-gray-400 sm:pt-3">
				<!-- הפין צבעוני ומלא: בקו אפור דק הוא היה עוד סימן חיוור בשורת הכתובת;
				     מלא ובאדום הוא נקרא כסמל מיקום במבט אחד, כמו 🎁 בשורת ההטבה. -->
				<svg
					class="h-3.5 w-3.5 flex-shrink-0 text-rose-400 sm:h-4 sm:w-4"
					fill="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.683 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
					/>
				</svg>
				<span class="line-clamp-1">{business.address || business.salesArea}</span>
			</div>

			<!-- הקטגוריות בתחתית: הן סיווג, לא כותרת משנה — למעלה הן דחפו את
			     מה שמוכר את העסק (דירוג, סלוגן, הטבה) מטה. ה-pl-9 שומר מרחק
			     מכפתור השיתוף שיושב בפינה. -->
			{#if business.category}
				<p class="mt-0.5 line-clamp-1 pl-9 text-xs text-gray-500">
					{business.category}
				</p>
			{/if}
		</div>
	</a>
</div>
