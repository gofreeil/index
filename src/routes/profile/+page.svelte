<script>
	import { lang, translations } from '$lib/i18n';
	import { logout } from '$lib/auth';

	let { data } = $props();
	const user = $derived(data.user);

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const initial = $derived((user?.name || '?').trim().charAt(0).toUpperCase());
</script>

<svelte:head>
	<title>{t.myArea} - {t.title}</title>
</svelte:head>

<div class="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center px-4 py-12">
	<div
		class="w-full rounded-2xl border border-gray-100 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800"
	>
		<!-- אווטאר + שם -->
		<div class="flex flex-col items-center gap-3 text-center">
			<div
				class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-lg"
				aria-hidden="true"
			>
				{initial}
			</div>
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400">{t.profileHello},</p>
				<h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{user?.name}</h1>
			</div>
		</div>

		<!-- פרטים -->
		<dl class="mt-8">
			<div
				class="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-700/40"
			>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{t.email}</dt>
				<dd class="text-sm font-bold text-gray-900 dark:text-gray-100" dir="ltr">{user?.email}</dd>
			</div>
		</dl>

		<!-- קיצורים -->
		<div class="mt-6 grid grid-cols-2 gap-3">
			<a
				href="/submit-business"
				class="flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:scale-[1.02] active:scale-95"
			>
				{t.addStore}
			</a>
			<a
				href="/"
				class="flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
			>
				{t.backToDirectory}
			</a>
		</div>

		<!-- ניהול — רק למורשים (הבדיקה האמיתית נאכפת בשרת של /admin) -->
		{#if data.isAdmin}
			<a
				href="/admin"
				class="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
			>
				🛡️ ניהול ומודרציה
			</a>
		{/if}

		<!-- התנתקות -->
		<button
			type="button"
			onclick={logout}
			class="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
		>
			{t.logout}
		</button>
	</div>
</div>
