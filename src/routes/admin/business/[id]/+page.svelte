<script>
	import { enhance } from '$app/forms';
	import { mediaUrl, STATUS_HE } from '$lib/businessShape.js';
	import { CATEGORIES } from '$lib/categories.js';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	const biz = $derived(data.biz);
	let saving = $state(false);

	// קטגוריה ישנה שאינה ברשימה הקנונית — עדיין מוצגת כאופציה כדי לא לאבד אותה
	const categoryOptions = $derived(
		biz.category && !CATEGORIES.includes(biz.category) ? [biz.category, ...CATEGORIES] : CATEGORIES
	);

	const banners = $derived(Array.isArray(biz.banners) ? biz.banners : []);

	const INPUT =
		'w-full rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500/60 focus:outline-none';
	const LABEL = 'mb-1.5 block text-sm font-bold text-gray-300';

	/** @param {string} k */
	const err = (k) => form?.errors?.[k] ?? '';
</script>

<svelte:head>
	<title>עריכת כרטיסייה — {biz.name || ''}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-3xl pb-10" dir="rtl">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-extrabold text-gray-100">עריכת כרטיסייה</h1>
			<p class="mt-1 text-sm text-gray-500">
				{biz.name} ·
				<span class="font-bold">{STATUS_HE[biz.status]?.[0] ?? biz.status}</span>
				{#if biz.rating_count}· ★ {Number(biz.rating_avg || 0).toFixed(1)} ({biz.rating_count}){/if}
				{#if biz.view_count}· 👁 {biz.view_count}{/if}
			</p>
		</div>
		<a href="/admin?tab=cards" class="text-sm text-gray-400 hover:text-blue-400">← לפאנל</a>
	</div>

	{#if form?.saved}
		<div
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-center text-green-300"
		>
			✓ הכרטיסייה נשמרה
		</div>
	{/if}
	{#if form?.error}
		<div
			class="mb-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-center text-red-300"
		>
			{form.error}
		</div>
	{/if}

	<form
		method="POST"
		action="?/save"
		enctype="multipart/form-data"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
		class="space-y-6"
	>
		<!-- פרטי העסק -->
		<section class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
			<h2 class="mb-4 font-bold text-gray-200">פרטי העסק</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label class={LABEL} for="f-name">שם העסק *</label>
					<input id="f-name" name="name" value={biz.name ?? ''} class={INPUT} required />
					{#if err('name')}<p class="mt-1 text-xs text-red-400">{err('name')}</p>{/if}
				</div>
				<div>
					<label class={LABEL} for="f-status">סטטוס</label>
					<select id="f-status" name="status" value={biz.status ?? 'pending'} class={INPUT}>
						<option value="pending">ממתין</option>
						<option value="approved">מאושר</option>
						<option value="frozen">מוקפא (מוסר מהאתר)</option>
						<option value="rejected">נדחה</option>
					</select>
				</div>
				<div>
					<label class={LABEL} for="f-category">קטגוריה</label>
					<select id="f-category" name="category" value={biz.category ?? ''} class={INPUT}>
						<option value="">— ללא —</option>
						{#each categoryOptions as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class={LABEL} for="f-subcategory">תת-קטגוריה / פירוט</label>
					<input
						id="f-subcategory"
						name="subcategory"
						value={biz.subcategory ?? ''}
						class={INPUT}
					/>
				</div>
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-description">תיאור קצר</label>
					<textarea
						id="f-description"
						name="description"
						rows="3"
						class={INPUT}
						value={biz.description ?? ''}
					></textarea>
				</div>
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-unique">תוכן ייחודי (מוצג בעמוד העסק)</label>
					<textarea
						id="f-unique"
						name="unique_content"
						rows="4"
						class={INPUT}
						value={biz.unique_content ?? ''}
					></textarea>
				</div>
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-discount">🎁 ההטבה הבלעדית לחברי הקהילה</label>
					<input id="f-discount" name="discount" value={biz.discount ?? ''} class={INPUT} />
				</div>
			</div>
		</section>

		<!-- יצירת קשר -->
		<section class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
			<h2 class="mb-4 font-bold text-gray-200">יצירת קשר</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label class={LABEL} for="f-contact">שם איש קשר</label>
					<input id="f-contact" name="contact_name" value={biz.contact_name ?? ''} class={INPUT} />
				</div>
				<div>
					<label class={LABEL} for="f-phone">טלפון</label>
					<input id="f-phone" name="phone" dir="ltr" value={biz.phone ?? ''} class={INPUT} />
				</div>
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-email">אימייל בעל העסק</label>
					<input
						id="f-email"
						name="email"
						type="email"
						dir="ltr"
						value={biz.email ?? ''}
						class={INPUT}
					/>
				</div>
			</div>
		</section>

		<!-- קישורים -->
		<section class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
			<h2 class="mb-4 font-bold text-gray-200">קישורים</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each [['website', 'אתר'], ['whatsapp', 'וואטסאפ'], ['facebook', 'פייסבוק'], ['instagram', 'אינסטגרם'], ['youtube', 'יוטיוב']] as [k, lbl] (k)}
					<div>
						<label class={LABEL} for="f-{k}">{lbl}</label>
						<input
							id="f-{k}"
							name={k}
							dir="ltr"
							placeholder="https://…"
							value={biz[k] ?? ''}
							class={INPUT}
						/>
						{#if err(k)}<p class="mt-1 text-xs text-red-400">{err(k)}</p>{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- מיקום -->
		<section class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
			<h2 class="mb-4 font-bold text-gray-200">מיקום</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-address">כתובת מלאה</label>
					<input id="f-address" name="address" value={biz.address ?? ''} class={INPUT} />
				</div>
				<div>
					<label class={LABEL} for="f-city">עיר</label>
					<input id="f-city" name="city" value={biz.city ?? ''} class={INPUT} />
				</div>
				<div>
					<label class={LABEL} for="f-neighborhood">שכונה</label>
					<input
						id="f-neighborhood"
						name="neighborhood"
						value={biz.neighborhood ?? ''}
						class={INPUT}
					/>
				</div>
				<div class="sm:col-span-2">
					<label class={LABEL} for="f-sales">אזור מכירה / שירות</label>
					<input id="f-sales" name="sales_area" value={biz.sales_area ?? ''} class={INPUT} />
				</div>
				<div>
					<label class={LABEL} for="f-lat">קו רוחב (lat)</label>
					<input id="f-lat" name="lat" dir="ltr" value={biz.lat ?? ''} class={INPUT} />
					{#if err('lat')}<p class="mt-1 text-xs text-red-400">{err('lat')}</p>{/if}
				</div>
				<div>
					<label class={LABEL} for="f-lng">קו אורך (lng)</label>
					<input id="f-lng" name="lng" dir="ltr" value={biz.lng ?? ''} class={INPUT} />
					{#if err('lng')}<p class="mt-1 text-xs text-red-400">{err('lng')}</p>{/if}
				</div>
			</div>
		</section>

		<!-- מדיה -->
		<section class="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
			<h2 class="mb-4 font-bold text-gray-200">מדיה</h2>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div>
					<span class={LABEL}>לוגו</span>
					{#if mediaUrl(biz.logo)}
						<img
							src={mediaUrl(biz.logo)}
							alt="לוגו נוכחי"
							class="mb-2 h-20 w-20 rounded-xl object-cover"
						/>
						<label class="mb-2 flex items-center gap-2 text-xs text-gray-400">
							<input type="checkbox" name="remove_logo" class="accent-red-500" /> הסר את הלוגו הנוכחי
						</label>
					{:else}
						<p class="mb-2 text-xs text-gray-600">אין לוגו</p>
					{/if}
					<input
						type="file"
						name="logo"
						accept="image/*"
						class="block w-full text-xs text-gray-400 file:me-3 file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-gray-200"
					/>
					{#if err('logo')}<p class="mt-1 text-xs text-red-400">{err('logo')}</p>{/if}
				</div>
				<div>
					<span class={LABEL}>תמונות העסק (עד 4 — העלאה חדשה מחליפה את כולן)</span>
					{#if banners.length}
						<div class="mb-2 flex flex-wrap gap-2">
							{#each banners as b, i (b?.id ?? i)}
								<img src={mediaUrl(b)} alt="" class="h-16 w-24 rounded-lg object-cover" />
							{/each}
						</div>
						<label class="mb-2 flex items-center gap-2 text-xs text-gray-400">
							<input type="checkbox" name="remove_banners" class="accent-red-500" /> הסר את כל התמונות
						</label>
					{:else}
						<p class="mb-2 text-xs text-gray-600">אין תמונות</p>
					{/if}
					<input
						type="file"
						name="banners"
						accept="image/*"
						multiple
						class="block w-full text-xs text-gray-400 file:me-3 file:rounded-lg file:border-0 file:bg-gray-700 file:px-3 file:py-1.5 file:text-gray-200"
					/>
					{#if err('banners')}<p class="mt-1 text-xs text-red-400">{err('banners')}</p>{/if}
				</div>
			</div>
		</section>

		<div class="flex items-center gap-3">
			<button
				disabled={saving}
				class="rounded-full bg-blue-600 px-8 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
			>
				{saving ? 'שומר…' : '💾 שמור שינויים'}
			</button>
			<a
				href="/business/{biz.documentId}"
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-full border border-gray-600 px-6 py-3 text-sm font-bold text-gray-300 transition hover:bg-gray-800"
			>
				צפה בעמוד העסק ↗
			</a>
		</div>
	</form>

	{#if data.superAdmin}
		<form
			method="POST"
			action="?/del"
			class="mt-10 border-t border-gray-800 pt-6"
			use:enhance={({ cancel }) => {
				if (!confirm(`למחוק לצמיתות את "${biz.name}"? הפעולה אינה הפיכה.`)) cancel();
			}}
		>
			<button
				class="rounded-full border border-red-500/40 bg-red-950/40 px-6 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-900/50"
			>
				🗑 מחיקה לצמיתות (סופר-אדמין)
			</button>
		</form>
	{/if}
</main>
