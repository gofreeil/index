<script>
	import { enhance } from '$app/forms';
	import { STATUS_HE } from '$lib/businessShape.js';
	import BusinessFormFields from '$lib/components/BusinessFormFields.svelte';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	const biz = $derived(data.biz);
	let saving = $state(false);

	// מי הבעלים הרשום של הכרטיסייה — נכתב בהגשה דרך הטופס או באישור
	// בקשת בעלות (/admin/claims). בלעדיו אף אחד מלבד אדמין לא יכול לערוך.
	const ownerId = $derived(String(biz.user_id ?? '') || String(biz.user?.id ?? ''));
	const ownerEmail = $derived(biz.extra_fields?.owner_email ?? '');
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

	<!-- שורת הבעלות — מי רשאי לערוך את הכרטיסייה מלבד האדמינים -->
	<div
		class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-2.5 text-sm"
	>
		<span class="text-gray-400">בעלות:</span>
		{#if ownerId}
			<span class="font-bold text-green-400">משויכת למשתמש #{ownerId}</span>
			{#if ownerEmail}<span class="text-gray-500" dir="ltr">{ownerEmail}</span>{/if}
			<span class="text-xs text-gray-500">· הבעלים רשאי לערוך את הדף שלו</span>
		{:else}
			<span class="font-bold text-amber-400">אין בעלים</span>
			<a href="/admin/claims" class="text-xs text-blue-400 hover:underline">
				לבדוק התאמות ובקשות בעלות ←
			</a>
		{/if}
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
		<BusinessFormFields {biz} errors={form?.errors ?? {}} canModerate />

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
