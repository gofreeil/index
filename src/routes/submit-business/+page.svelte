<script>
	import Seo from '$lib/components/Seo.svelte';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { CATEGORIES } from '$lib/categories.js';
	import { MAX_BRANCHES, parseBranches } from '$lib/branches.js';
	import { LINK_FIELDS } from '$lib/socialLinks.js';
	import { formDraft, clearDraft, resumeDraft } from '$lib/formDraft';

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
	const DRAFT_KEY = 'index-submit-business';
	const DRAFT_EXCLUDE = ['form_rendered_at', 'company_website'];
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
				onRestore: () => (draftRestored = true)
			}}
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
							<option value="" disabled selected={!v.category}>בחרו קטגוריה…</option>
							{#each categoryOptions as cat (cat.value)}
								<option value={cat.value} selected={v.category === cat.value}>{cat.label}</option>
							{/each}
						</select>
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

				<div>
					<label for="description" class="mb-1 block text-sm font-medium text-gray-300"
						>תיאור קצר *</label
					>
					<textarea id="description" name="description" required rows="3" class="field"
						>{v.description ?? ''}</textarea
					>
					{#if errors.description}<p class="err">{errors.description}</p>{/if}
				</div>

				<div>
					<label for="unique_content" class="mb-1 block text-sm font-medium text-gray-300"
						>מה מייחד אתכם?</label
					>
					<textarea id="unique_content" name="unique_content" rows="2" class="field"
						>{v.unique_content ?? ''}</textarea
					>
				</div>
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
				<label class="flex items-start gap-3 text-sm text-gray-300">
					<input type="checkbox" name="accepted_terms" class="mt-1 h-4 w-4 shrink-0" />
					<span
						>אני מקבל/ת על עצמי את
						<a href="/policy" target="_blank" class="text-blue-400 underline">תנאי הקהילה</a>
						(כולל הקוד האתי העולמי וזכות המזומן) ומתחייב/ת להטבה שציינתי לחברי הקהילה. *</span
					>
				</label>
				{#if errors.accepted_terms}<p class="err">{errors.accepted_terms}</p>{/if}
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

			<!-- נוכחות דיגיטלית + לוגו -->
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
				<div>
					<label for="logo" class="mb-1 block text-sm font-medium text-gray-300"
						>לוגו העסק (תמונה עד 3MB)</label
					>
					<input
						id="logo"
						name="logo"
						type="file"
						accept="image/*"
						class="field file:mr-3 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-1 file:text-white"
					/>
					{#if errors.logo}<p class="err">{errors.logo}</p>{/if}
				</div>
				<div>
					<label for="banners" class="mb-1 block text-sm font-medium text-gray-300"
						>תמונות העסק (עד 4 תמונות, כל אחת עד 3MB)</label
					>
					<input
						id="banners"
						name="banners"
						type="file"
						accept="image/*"
						multiple
						class="field file:mr-3 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-1 file:text-white"
					/>
					{#if errors.banners}<p class="err">{errors.banners}</p>{/if}
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
