<script>
	import Seo from '$lib/components/Seo.svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { CATEGORIES } from '$lib/categories.js';
	import { MAX_BRANCHES, parseBranches } from '$lib/branches.js';
	import { LINK_FIELDS } from '$lib/socialLinks.js';
	import ImageDropField from '$lib/components/ImageDropField.svelte';
	import ImageFitEditor from '$lib/components/ImageFitEditor.svelte';
	import TagsField from '$lib/components/TagsField.svelte';
	import TermsConsent from '$lib/components/TermsConsent.svelte';
	import { parseTags } from '$lib/tags.js';
	import { suggestTags } from '$lib/tagSuggest.js';
	import {
		parseFit,
		parseFitList,
		parseLogoShape,
		parseMainIndex,
		DEFAULT_FIT,
		MAX_BANNERS
	} from '$lib/mediaFit.js';
	import { formDraft, clearDraft, resumeDraft } from '$lib/formDraft';
	import { recallCategory } from '$lib/lastCategory.js';
	import { TERMS_FIELD } from '$lib/terms.js';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	// הרשימה מהשרת כוללת את דריסות הסופר-אדמין (שמות וקטגוריות שנוספו);
	// הרשימה הסטטית היא רשת ביטחון אם הטעינה לא החזירה כלום
	const categoryOptions = $derived(
		Array.isArray(data?.categoryOptions) && data.categoryOptions.length
			? data.categoryOptions
			: CATEGORIES.map((c) => ({ value: c, label: c }))
	);

	let submitting = $state(false);
	let renderedAt = $state(0);
	onMount(() => (renderedAt = Date.now()));

	// טיוטה אוטומטית — טופס ארוך; יציאה לדף אחר או רענון לא ימחקו אותו.
	// חותמת הזמן וה-honeypot לא נשמרים: הם בדיקת אנטי-ספאם של השליחה הנוכחית.
	// גם אישור התנאים אינו נשמר — הוא התחייבות, ונעשה בכל שליחה מחדש.
	const DRAFT_KEY = 'index-submit-business';
	const DRAFT_EXCLUDE = ['form_rendered_at', 'company_website', TERMS_FIELD];
	let draftRestored = $state(false);
	/** @type {HTMLFormElement | null} */
	let formEl = $state(null);

	function discardDraft() {
		clearDraft(DRAFT_KEY);
		resumeDraft(DRAFT_KEY);
		formEl?.reset();
		draftRestored = false;
	}

	// ערכים חוזרים אחרי כישלון ולידציה (כדי לא לאבד מילוי)
	const v = $derived(form?.values ?? {});
	const errors = $derived(form?.errors ?? {});

	/* ── התחום שהגיע מדף הבית ──
	   מי שגלש בתוך תחום במסילה ולחץ "הוסף עסק" מצפה שהטופס כבר ידע איפה הוא
	   היה — הוא בחר את התחום כבר בקליק הקודם, וחיפוש חוזר שלו ברשימה הוא
	   בקשה לעשות פעמיים את אותו דבר. שני מקורות, לפי סדר עדיפות:

	     1. ‎?category=…‎ בשאילתה — הקיצור "יש לכם עסק בתחום הזה?" שבתוך התחום.
	     2. sessionStorage (ראו $lib/lastCategory) — התחום האחרון שנפתח במסילה.
	        זו הדלת של כפתור "הוסף עסק" הקבוע שבכותרת: קישור סטטי בלייאאוט
	        שאינו יודע איזה תחום פתוח בדף, ולכן דף הבית רושם את הבחירה בצד
	        והטופס קורא אותה כאן. נקרא ב-onMount — הדפדפן בלבד מכיר אותו.

	   מתקבל רק ערך שקיים ברשימת התחומים — פרמטר שהומצא ב-URL (או רישום ישן
	   של תחום שנמחק) לא יוצר אפשרות חדשה בבורר. ערך שחזר מכישלון ולידציה
	   גובר על שניהם: הוא מה שהגולש הקליד עכשיו.

	   ההשוואה גם מול value וגם מול label: המסילה שולחת את שם התצוגה, אבל
	   לקטגוריה מובנית ששמה נדרס במסך הניהול ה-value הוא השם הקנוני הישן
	   (ראו getCategoryOptions) — השוואה מול value בלבד הפילה בשקט כל תחום
	   ששמו שונה. מוחזר ה-value של האופציה: הוא מה שהבורר באמת שולח בשליחה. */
	const validCategory = (/** @type {string | null | undefined} */ q) => {
		const name = q?.trim();
		if (!name) return '';
		const hit = categoryOptions.find(
			(/** @type {any} */ c) => c.value === name || c.label === name
		);
		return hit ? hit.value : '';
	};
	const queryPreset = $derived(validCategory(page.url.searchParams.get('category')));
	let sessionPreset = $state('');
	const presetCategory = $derived(queryPreset || sessionPreset);
	const initialCategory = $derived(v.category || presetCategory);

	onMount(() => {
		sessionPreset = validCategory(recallCategory());
		applyPresetCategory();
	});

	/** כתיבת התחום אל הבורר עצמו + שיגור האירועים שמעדכנים את הצעות התגיות.
	 *  נקראת פעמיים: ב-onMount (המקור מ-sessionStorage לא קיים ב-SSR, ולכן
	 *  ה-selected שברינדור לא כיסה אותו), ואחרי שחזור טיוטה — השחזור עלול
	 *  לדרוס את התחום שהגיע מדף הבית, והלחיצה שהביאה לכאן טרייה מכל טיוטה. */
	function applyPresetCategory() {
		if (!presetCategory || v.category || !formEl) return;
		const el = /** @type {HTMLSelectElement | null} */ (
			formEl.querySelector('select[name="category"]')
		);
		if (!el || el.value === presetCategory) return;
		el.value = presetCategory;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}

	// ── סניפים ומקומות שירות נוספים ──
	// שורות שנפתחות בלחיצה. הן נשלחות כ-JSON בשדה מוסתר אחד ולא כשדות
	// חוזרים (ראו branches.js), ולכן גם הטיוטה וגם חזרה אחרי שגיאת ולידציה
	// עובדות עליהן בלי טיפול מיוחד. לשדות עצמם אין name — הם רק ממשק.
	let branches = $state(parseBranches(form?.values?.branches));
	const branchesJson = $derived(JSON.stringify(branches));

	function addBranch() {
		if (branches.length >= MAX_BRANCHES) return;
		branches = [...branches, { city: '', neighborhood: '', address: '' }];
	}

	/** @param {number} i */
	function removeBranch(i) {
		branches = branches.filter((_, idx) => idx !== i);
	}

	// שחזור הטיוטה כותב ל-input המוסתר ומשגר change — משם השורות חוזרות למסך
	/** @param {Event & { currentTarget: HTMLInputElement }} e */
	function syncBranches(e) {
		branches = parseBranches(e.currentTarget.value);
	}

	// ── תגיות ──
	// המילים שבהן יחפשו את העסק. נשמרות כמו הסניפים — JSON בשדה מוסתר אחד,
	// ומשם ל-extra_fields (ראו tags.js).
	let tags = $state(parseTags(form?.values?.tags));

	/* ההצעות נגזרות ממה שכבר מולא בטופס, ולכן הן משתנות תוך כדי ההקלדה.
	   השדות עצמם אינם bind:value אלא defaultValue (כך עובד שחזור הטיוטה),
	   ולכן הערכים נקראים מאירועי הטופס עצמו: מאזין אחד על ה-form, במקום
	   לשנות עשרה שדות קיימים. שחזור הטיוטה משגר input/change בעצמו
	   (ראו applyToForm ב-formDraft.ts), ולכן גם הוא נקלט כאן. */
	let live = $state({ ...(form?.values ?? {}) });

	/** @param {Event} e */
	function readField(e) {
		const el = /** @type {any} */ (e.target);
		if (el?.name && typeof el.value === 'string') live = { ...live, [el.name]: el.value };
	}

	const tagSuggestions = $derived(
		suggestTags(
			{
				name: live.name,
				category: live.category,
				subcategory: live.subcategory,
				description: live.unique_content,
				discount: live.discount,
				city: live.city,
				neighborhood: live.neighborhood,
				salesArea: live.sales_area,
				branches
			},
			{ chosen: tags, queries: data?.topQueries ?? [], popular: data?.popularTags ?? [] }
		)
	);

	// ── מיקום וזום של הלוגו והתמונות ──
	// העורך עובד על התמונה שנבחרה עכשיו, ונשלח כ-JSON בשדה מוסתר אחד.
	let logoFit = $state(parseFit(null));
	let bannerFits = $state(parseFitList([]));
	// מסגרת הלוגו בכרטיסייה — ריבוע מעוגל (ברירת מחדל) או עיגול
	let logoShape = $state(parseLogoShape(null));
	// התמונה הראשית — הבאנר של האריח בדף הבית ופתיחת הגלריה בכרטיסייה
	let mainIndex = $state(parseMainIndex(null));
	/** @type {{name: string, url: string}[]} */
	let logoPicked = $state([]);
	/** @type {{name: string, url: string}[]} */
	let bannersPicked = $state([]);

	$effect(() => {
		if (bannersPicked.length > bannerFits.length) {
			bannerFits = bannersPicked.map((_, i) => bannerFits[i] ?? { ...DEFAULT_FIT });
		}
	});

	const mediaFitJson = $derived(
		JSON.stringify({
			logo: logoFit,
			banners: bannerFits.slice(0, bannersPicked.length),
			logo_shape: logoShape,
			// בחירה שהתייתמה אחרי החלפת התמונות חוזרת לראשונה
			main: mainIndex < bannersPicked.length ? mainIndex : 0
		})
	);
</script>

<Seo
	title="הוספת עסק לאינדקס בעלי המקצוע — רישום חינם"
	description="בעלי מקצוע: הצטרפו בחינם לאינדקס בעלי המקצוע הכשירים של יוצאים לחירות. מקבלים דף עסק שמופיע בגוגל, עם תיאור, אזור שירות, טלפון, וואטסאפ ודירוגים של לקוחות. התנאי: חתימה על אמנת הקהילה והטבה לחברי הקהילה."
	path="/submit-business"
	keywords="הוספת עסק, רישום בעל מקצוע, פרסום עסק חינם, אינדקס בעלי מקצוע"
/>

<main class="mx-auto max-w-2xl px-4 py-10 sm:px-6" dir="rtl">
	{#if form?.success}
		<div class="rounded-3xl border border-green-500/30 bg-green-900/10 p-10 text-center shadow-xl">
			<div class="mb-4 text-6xl">✅</div>
			<h1 class="mb-3 text-2xl font-black text-green-400">הבקשה התקבלה!</h1>
			<p class="mx-auto mb-8 max-w-md leading-relaxed text-gray-300">
				העסק נשלח לצוות האינדקס ויופיע במדריך לאחר בדיקה ואישור. תודה שהצטרפתם לקהילת בעלי המקצוע
				הכשירים של יוצאים לחירות.
			</p>
			<div class="flex flex-col justify-center gap-3 sm:flex-row">
				<a
					href="/"
					class="rounded-full bg-gray-800 px-6 py-3 font-bold text-blue-400 transition hover:bg-gray-700"
					>חזרה למדריך</a
				>
				<a
					href="/submit-business"
					data-sveltekit-reload
					class="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:scale-105"
					>הגשת עסק נוסף</a
				>
			</div>
		</div>
	{:else}
		<div class="mb-8 text-center">
			<h1
				class="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-3xl font-extrabold text-transparent sm:text-4xl"
			>
				הוספת עסק למדריך
			</h1>
			<p class="mt-3 text-sm leading-relaxed text-gray-400">
				המדריך פתוח לבעלי מקצוע שמתחייבים להטבה בלעדית לחברי הקהילה ולתנאי הקהילה. מלאו את הפרטים —
				העסק יעבור בדיקה ויתפרסם לאחר אישור.
			</p>
		</div>

		{#if form?.error}
			<div
				class="mb-6 rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-center text-red-300"
			>
				{form.error}
			</div>
		{/if}

		{#if draftRestored}
			<div
				class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm text-green-200"
			>
				<span class="font-bold">💾 שחזרנו את מה שמילאת קודם — הטופס ממשיך מהמקום שעצרת.</span>
				<button
					type="button"
					onclick={discardDraft}
					class="rounded-full border border-green-500/40 bg-green-900/40 px-3 py-1 text-xs font-bold text-green-100 transition hover:bg-green-800/50"
				>
					התחל מטופס ריק
				</button>
			</div>
		{/if}

		<form
			bind:this={formEl}
			method="POST"
			enctype="multipart/form-data"
			use:formDraft={{
				key: DRAFT_KEY,
				exclude: DRAFT_EXCLUDE,
				onRestore: () => {
					draftRestored = true;
					applyPresetCategory();
				}
			}}
			oninput={readField}
			onchange={readField}
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					// נשלח בהצלחה — הטיוטה סיימה את תפקידה (לפני הרינדור מחדש)
					if (result.type === 'redirect' || result.type === 'success') clearDraft(DRAFT_KEY);
					await update();
					submitting = false;
				};
			}}
			class="space-y-6"
		>
			<!-- honeypot (מוסתר מבני-אדם) -->
			<input
				type="text"
				name="company_website"
				tabindex="-1"
				autocomplete="off"
				class="absolute right-[-9999px] h-0 w-0 opacity-0"
				aria-hidden="true"
			/>
			<input type="hidden" name="form_rendered_at" value={renderedAt} />

			<!-- פרטי העסק -->
			<fieldset class="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
				<legend class="px-2 text-sm font-bold text-blue-400">פרטי העסק</legend>

				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-300"
						>שם העסק / השירות *</label
					>
					<input id="name" name="name" required defaultValue={v.name ?? ''} class="field" />
					{#if errors.name}<p class="err">{errors.name}</p>{/if}
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="category" class="mb-1 block text-sm font-medium text-gray-300"
							>קטגוריה *</label
						>
						<select id="category" name="category" required class="field">
							<option value="" disabled selected={!initialCategory}>בחרו קטגוריה…</option>
							{#each categoryOptions as cat (cat.value)}
								<option value={cat.value} selected={initialCategory === cat.value}
									>{cat.label}</option
								>
							{/each}
						</select>
						{#if presetCategory && !v.category}
							<p class="mt-1 text-xs text-blue-300/80">
								התחום נבחר לפי המקום שממנו הגעתם — אפשר לשנות.
							</p>
						{/if}
						{#if errors.category}<p class="err">{errors.category}</p>{/if}
					</div>
					<div>
						<label for="subcategory" class="mb-1 block text-sm font-medium text-gray-300"
							>תת-תחום (חופשי)</label
						>
						<input
							id="subcategory"
							name="subcategory"
							defaultValue={v.subcategory ?? ''}
							class="field"
						/>
					</div>
				</div>

				<!-- תיבת טקסט אחת ולא שתיים ("תיאור קצר" + "מה מייחד אתכם?"): שתיהן
				     נכתבו לאותו מקום בכרטיסייה, וההפרדה רק פיצלה את מה שנכתב. -->
				<div>
					<label for="unique_content" class="mb-1 block text-sm font-medium text-gray-300"
						>תיאור מורחב *</label
					>
					<textarea
						id="unique_content"
						name="unique_content"
						required
						rows="4"
						placeholder="מה אתם עושים, למי, ומה מייחד אתכם"
						class="field">{v.unique_content ?? ''}</textarea
					>
					{#if errors.unique_content}<p class="err">{errors.unique_content}</p>{/if}
				</div>

				<!-- תגיות — אחרי התיאור בכוונה: ההצעות נבנות ממה שכבר נכתב
				     למעלה, ולכן בשלב הזה הן כבר יודעות על מה מדובר. -->
				<TagsField
					bind:tags
					suggestions={tagSuggestions}
					inputClass="w-full rounded-[0.6rem] border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900/30"
					labelClass="mb-1 block text-sm font-medium text-gray-300"
				/>
			</fieldset>

			<!-- הטבה + תנאים (חובה, load-bearing) -->
			<fieldset class="space-y-4 rounded-2xl border border-green-800/40 bg-green-900/10 p-5">
				<legend class="px-2 text-sm font-bold text-green-400">ההטבה לחברי הקהילה</legend>
				<div>
					<label for="discount" class="mb-1 block text-sm font-medium text-gray-300"
						>ההטבה / ההנחה הבלעדית לחברי יוצאים לחירות *</label
					>
					<input
						id="discount"
						name="discount"
						required
						defaultValue={v.discount ?? ''}
						placeholder="למשל: 10% הנחה לחברי הקהילה"
						class="field"
					/>
					{#if errors.discount}<p class="err">{errors.discount}</p>{/if}
				</div>
				<TermsConsent
					text="אני מקבל/ת על עצמי את תנאי הקהילה של יוצאים לחירות — כולל הקוד האתי העולמי וזכות המזומן — ומתחייב/ת להטבה שציינתי לחברי הקהילה. *"
					error={errors.accepted_terms ?? ''}
				/>
			</fieldset>

			<!-- קשר ומיקום -->
			<fieldset class="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
				<legend class="px-2 text-sm font-bold text-blue-400">קשר ומיקום</legend>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="contact_name" class="mb-1 block text-sm font-medium text-gray-300"
							>שם איש קשר *</label
						>
						<input
							id="contact_name"
							name="contact_name"
							required
							defaultValue={v.contact_name ?? ''}
							class="field"
						/>
						{#if errors.contact_name}<p class="err">{errors.contact_name}</p>{/if}
					</div>
					<div>
						<label for="phone" class="mb-1 block text-sm font-medium text-gray-300">טלפון *</label>
						<input
							id="phone"
							name="phone"
							type="tel"
							required
							defaultValue={v.phone ?? ''}
							class="field"
						/>
						{#if errors.phone}<p class="err">{errors.phone}</p>{/if}
					</div>
				</div>
				<div>
					<label for="email" class="mb-1 block text-sm font-medium text-gray-300"
						>אימייל * <span class="text-gray-500">(פרטי — לעריכת העסק בעתיד)</span></label
					>
					<input
						id="email"
						name="email"
						type="email"
						required
						defaultValue={v.email ?? ''}
						class="field"
					/>
					{#if errors.email}<p class="err">{errors.email}</p>{/if}
				</div>
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<label for="city" class="mb-1 block text-sm font-medium text-gray-300">עיר</label>
						<input id="city" name="city" defaultValue={v.city ?? ''} class="field" />
					</div>
					<div>
						<label for="neighborhood" class="mb-1 block text-sm font-medium text-gray-300"
							>שכונה</label
						>
						<input
							id="neighborhood"
							name="neighborhood"
							defaultValue={v.neighborhood ?? ''}
							class="field"
						/>
					</div>
					<div>
						<label for="sales_area" class="mb-1 block text-sm font-medium text-gray-300"
							>אזור מכירה</label
						>
						<input
							id="sales_area"
							name="sales_area"
							defaultValue={v.sales_area ?? ''}
							placeholder="ארצי / אונליין"
							class="field"
						/>
					</div>
				</div>
				<div>
					<label for="address" class="mb-1 block text-sm font-medium text-gray-300"
						>כתובת מלאה *</label
					>
					<input
						id="address"
						name="address"
						required
						defaultValue={v.address ?? ''}
						class="field"
					/>
					<p class="mt-1 text-xs text-gray-500">
						העסק יופיע אוטומטית על המפה — גם כאן במדריך וגם באתר "קהילה בשכונה".
					</p>
					{#if errors.address}<p class="err">{errors.address}</p>{/if}
				</div>

				<!-- מקומות נוספים: סניף שני, מחסן, קליניקה בעיר אחרת -->
				<div class="rounded-xl border border-dashed border-gray-700 p-4">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<span class="text-sm font-medium text-gray-300">סניפים ומקומות שירות נוספים</span>
							<p class="mt-0.5 text-xs text-gray-500">
								יש לכם יותר ממקום אחד? כל מקום שתוסיפו יופיע גם הוא על המפה.
							</p>
						</div>
						<button
							type="button"
							onclick={addBranch}
							disabled={branches.length >= MAX_BRANCHES}
							class="shrink-0 rounded-full border border-blue-500/40 bg-blue-600/10 px-4 py-1.5 text-sm font-bold text-blue-300 transition hover:bg-blue-600/20 disabled:opacity-40"
						>
							＋ הוספת מקום
						</button>
					</div>

					{#each branches as branch, i (branch)}
						<div class="mt-3 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
							<div class="mb-2 flex items-center justify-between gap-2">
								<span class="text-xs font-bold text-gray-400">מקום נוסף {i + 1}</span>
								<button
									type="button"
									onclick={() => removeBranch(i)}
									class="text-xs font-bold text-red-400 transition hover:text-red-300"
								>
									הסרה
								</button>
							</div>
							<div class="grid gap-3 sm:grid-cols-3">
								<input
									bind:value={branch.city}
									placeholder="עיר"
									aria-label="עיר — מקום נוסף {i + 1}"
									class="field"
								/>
								<input
									bind:value={branch.neighborhood}
									placeholder="שכונה"
									aria-label="שכונה — מקום נוסף {i + 1}"
									class="field"
								/>
								<input
									bind:value={branch.address}
									placeholder="כתובת מלאה"
									aria-label="כתובת — מקום נוסף {i + 1}"
									class="field"
								/>
							</div>
						</div>
					{/each}

					{#if branches.length >= MAX_BRANCHES}
						<p class="mt-3 text-xs text-gray-500">
							הגעתם ל-{MAX_BRANCHES} מקומות — אפשר לפרט את השאר בשדה "אזור מכירה".
						</p>
					{/if}

					<input type="hidden" name="branches" value={branchesJson} onchange={syncBranches} />
				</div>
			</fieldset>

			<!-- תמונות — מיד אחרי השם, הטלפון והכתובת: זה מה שרואים בכרטיסייה -->
			<fieldset class="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
				<legend class="px-2 text-sm font-bold text-blue-400">תמונות וסרטון</legend>
				<div>
					<span id="lbl-logo" class="mb-1 block text-sm font-medium text-gray-300"
						>לוגו העסק (תמונה עד 3MB)</span
					>
					<ImageDropField
						name="logo"
						labelledBy="lbl-logo"
						hint="PNG או JPG, עד 3MB"
						bind:previews={logoPicked}
					/>
					{#if logoPicked[0]}
						<!-- מסגרת הלוגו: הבחירה משנה מיד את התצוגה המקדימה -->
						<div class="mt-3 flex items-center gap-2 text-xs">
							<span class="text-gray-400">מסגרת הלוגו:</span>
							{#each [['square', 'מרובע'], ['circle', 'עגול']] as [value, label] (value)}
								<button
									type="button"
									onclick={() => (logoShape = /** @type {any} */ (value))}
									aria-pressed={logoShape === value}
									class="rounded-lg border px-3 py-1 font-bold transition {logoShape === value
										? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
										: 'border-gray-700 text-gray-400 hover:border-gray-500'}"
								>
									{label}
								</button>
							{/each}
						</div>
						<div class="mt-3">
							<ImageFitEditor
								src={logoPicked[0].url}
								bind:fit={logoFit}
								aspect="square"
								mode="contain"
								label="לוגו"
								round={logoShape === 'circle'}
							/>
						</div>
					{/if}
					{#if errors.logo}<p class="err">{errors.logo}</p>{/if}
				</div>
				<div>
					<span id="lbl-banners" class="mb-1 block text-sm font-medium text-gray-300"
						>תמונות העסק (עד {MAX_BANNERS} תמונות, כל אחת עד 3MB)</span
					>
					<ImageDropField
						name="banners"
						labelledBy="lbl-banners"
						multiple
						max={MAX_BANNERS}
						hint="אפשר לגרור כמה תמונות יחד, או אחת בכל פעם"
						bind:previews={bannersPicked}
					/>
					{#each bannersPicked as p, i (p.url)}
						<div class="mt-3">
							<div class="mb-1 flex flex-wrap items-center gap-2 text-xs">
								<span class="font-bold text-gray-400">תמונה {i + 1}</span>
								<!-- התמונה הראשית: הבאנר של האריח בדף הבית, פתיחת הגלריה
								     בכרטיסייה ותמונת השיתוף -->
								{#if mainIndex === i}
									<span
										class="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-300"
										>★ ראשית</span
									>
								{:else}
									<button
										type="button"
										onclick={() => (mainIndex = i)}
										class="rounded-full border border-gray-700 px-2 py-0.5 font-bold text-gray-400 transition hover:border-amber-500/50 hover:text-amber-300"
									>
										☆ הפוך לראשית
									</button>
								{/if}
							</div>
							<ImageFitEditor
								src={p.url}
								bind:fit={bannerFits[i]}
								aspect="wide"
								label="תמונה {i + 1}"
								highlight={mainIndex === i}
							/>
						</div>
					{/each}
					{#if bannersPicked.length > 1}
						<p class="mt-2 text-xs text-gray-500">
							התמונה הראשית היא שמופיעה באריח של העסק בדף הבית ובשיתוף.
						</p>
					{/if}
					{#if errors.banners}<p class="err">{errors.banners}</p>{/if}
				</div>
				<!-- סרטון התדמית הוא נגן מוטמע בכרטיסייה, ולכן שדה משלו ולא
				     שורה ברשימת הקישורים — שם יושב ערוץ היוטיוב -->
				<div>
					<label for="video" class="mb-1 block text-sm font-medium text-gray-300"
						>סרטון תדמית (קישור ליוטיוב)</label
					>
					<input
						id="video"
						name="video"
						defaultValue={v.video ?? ''}
						placeholder="https://youtube.com/watch?v=…"
						class="field"
					/>
					<p class="mt-1 text-xs text-gray-500">הסרטון יוטמע בכרטיסייה ויוצג לגולשים.</p>
					{#if errors.video}<p class="err">{errors.video}</p>{/if}
				</div>
				<input type="hidden" name="media_fit" value={mediaFitJson} />
			</fieldset>

			<!-- נוכחות דיגיטלית -->
			<fieldset class="space-y-4 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
				<legend class="px-2 text-sm font-bold text-blue-400">נוכחות דיגיטלית</legend>
				<!-- הרשתות והקישורים — הרשימה, התוויות והדוגמאות מגיעות מ-socialLinks.js,
				     אותו מקור שממנו נבנים טופס העריכה ושורת הלוגואים בכרטיסייה. -->
				<div class="grid gap-4 sm:grid-cols-2">
					{#each LINK_FIELDS as [k, lbl, ph] (k)}
						<div>
							<label for={k} class="mb-1 block text-sm font-medium text-gray-300">{lbl}</label>
							<input id={k} name={k} defaultValue={v[k] ?? ''} placeholder={ph} class="field" />
							{#if errors[k]}<p class="err">{errors[k]}</p>{/if}
						</div>
					{/each}
				</div>
			</fieldset>

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3.5 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
			>
				{submitting ? 'שולח…' : 'שליחת העסק לאישור'}
			</button>
			<p class="text-center text-xs text-gray-500">
				* שדות חובה. הפרטים נשלחים לצוות האינדקס לאישור.
			</p>
		</form>
	{/if}
</main>

<style>
	.field {
		width: 100%;
		border-radius: 0.6rem;
		border: 1px solid #374151;
		background: #1f2937;
		padding: 0.55rem 0.75rem;
		color: #f3f4f6;
		outline: none;
	}
	.field:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}
	.err {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: #f87171;
	}
</style>
