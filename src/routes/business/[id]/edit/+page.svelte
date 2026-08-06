<script>
	import { enhance } from '$app/forms';
	import { STATUS_HE } from '$lib/businessShape.js';
	import BusinessFormFields from '$lib/components/BusinessFormFields.svelte';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	const biz = $derived(data.biz);
	let saving = $state(false);
</script>

<svelte:head>
	<title>עריכת הכרטיסייה — {biz.name || ''}</title>
	<!-- מסך עריכה אינו תוכן לחיפוש -->
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-10 sm:px-6" dir="rtl">
	<a href="/business/{biz.documentId}" class="text-xs text-gray-500 transition hover:text-gray-300">
		→ חזרה לדף העסק
	</a>

	<div class="mt-4 mb-6">
		<h1 class="text-2xl font-semibold text-gray-50">עריכת הכרטיסייה</h1>
		<p class="mt-1 text-sm text-gray-500">
			{biz.name} · <span class="font-bold">{STATUS_HE[biz.status]?.[0] ?? biz.status}</span>
			{#if data.isOwner}
				· <span class="text-green-400">הכרטיסייה שלך</span>
			{:else if data.isAdmin}
				· <span class="text-amber-400">עריכת אדמין</span>
			{/if}
		</p>
	</div>

	{#if data.isOwner && !data.isAdmin}
		<p
			class="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-gray-400"
		>
			הפרטים שכאן הם מה שהגולשים רואים בדף שלך. שמרו על מספר טלפון פעיל, תיאור מדויק וההטבה
			שהתחייבתם לה — הכרטיסייה מתעדכנת באתר מיד עם השמירה.
		</p>
	{/if}

	{#if form?.saved}
		<div
			class="mb-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-center text-green-300"
		>
			✓ הפרטים נשמרו
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
		<BusinessFormFields {biz} errors={form?.errors ?? {}} canModerate={data.isAdmin} />

		<div class="flex flex-wrap items-center gap-3">
			<button
				disabled={saving}
				class="rounded-full bg-blue-600 px-8 py-3 font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
			>
				{saving ? 'שומר…' : '💾 שמור שינויים'}
			</button>
			<a
				href="/business/{biz.documentId}"
				class="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-gray-300 transition hover:border-white/30 hover:text-white"
			>
				לדף העסק
			</a>
			{#if data.isAdmin}
				<a
					href="/admin/business/{biz.documentId}"
					class="text-sm text-gray-500 transition hover:text-blue-400"
				>
					למסך הניהול המלא ←
				</a>
			{/if}
		</div>
	</form>
</main>
