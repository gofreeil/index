<script>
	// מעטפת אחידה לכל מסכי הניהול — כותרת, זהות המנהל וסרגל ניווט.
	// רשימת המסכים מגיעה מ-$lib/adminNav.js, אותה רשימה בדיוק שמוצגת
	// פרוסה כאריחים באזור האישי (/profile#admin), כדי שלא יתפצלו.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { adminNav, isActiveNav } from '$lib/adminNav.js';

	/** @type {{ children: import('svelte').Snippet, data: any }} */
	let { children, data } = $props();

	const isAdmin = $derived(Boolean(data.isAdmin));
	const nav = $derived(adminNav(isAdmin, Boolean(data.superAdmin)));
	const pending = $derived(
		data.pending ?? { businesses: 0, reviews: 0, reports: 0, ads: 0, total: 0 }
	);
	// ?tab=... הוא מה שקובע איזו לשונית פעילה ב-/admin (ראו admin/+page.svelte)
	const currentTab = $derived(page.url.searchParams.get('tab'));

	/** מונה ההמתנה של המסך — הבועה האדומה. @param {any} item */
	const alertOf = (item) => (item.alert ? (pending[item.alert] ?? 0) : 0);
	/** מונה "כמה נתונים יש" — תגית אפורה, לא התראה. @param {any} item */
	const countOf = (item) => (item.count === 'all' ? (data.businessesTotal ?? 0) : 0);

	// חזרה דף אחורה; בכניסה ישירה לכתובת נופלים לעמוד הפאנל הראשי.
	function goBack() {
		if (typeof history !== 'undefined' && history.length > 1) history.back();
		else goto('/admin');
	}
</script>

<div dir="rtl" class="mx-auto max-w-6xl px-3 pt-6 sm:px-6">
	{#if isAdmin}
		<!-- כותרת הפאנל -->
		<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="text-3xl" aria-hidden="true">🛠️</span>
				<div>
					<h1 class="text-2xl font-extrabold text-gray-100 sm:text-3xl">פאנל ניהול</h1>
					<p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
						<span
							class="rounded-full border px-2 py-0.5 font-bold {data.superAdmin
								? 'border-amber-500/40 bg-amber-900/30 text-amber-300'
								: 'border-blue-500/40 bg-blue-900/30 text-blue-300'}"
						>
							{data.superAdmin ? '👑 סופר-אדמין' : '🛡️ אדמין'}
						</span>
						<span>{data.user?.name} · {data.user?.email}</span>
					</p>
				</div>
			</div>
			<div class="flex flex-shrink-0 items-center gap-2">
				<button
					type="button"
					onclick={goBack}
					class="rounded-full border border-gray-700 bg-gray-900/60 px-3.5 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
				>
					↩ חזור
				</button>
				<a
					href="/profile"
					class="rounded-full border border-gray-700 bg-gray-900/60 px-3.5 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
				>
					👤 האזור האישי
				</a>
				<a
					href="/"
					class="rounded-full border border-gray-700 bg-gray-900/60 px-3.5 py-1.5 text-sm font-bold text-gray-200 transition hover:bg-gray-800"
				>
					← לאתר
				</a>
			</div>
		</div>

		<!-- סרגל הניווט. הבועה האדומה = פריטים שממתינים לטיפול באותו מסך;
		     הסכום שלהן הוא בדיוק המספר שעל האווטאר בהאדר. -->
		<nav class="mb-6 flex flex-wrap gap-2 border-b border-gray-800 pb-4">
			{#each nav as item (item.href)}
				{@const alert = alertOf(item)}
				{@const count = countOf(item)}
				<a
					href={item.href}
					class="relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all {isActiveNav(
						item,
						page.url.pathname,
						currentTab
					)
						? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
						: 'bg-gray-900/60 text-gray-300 hover:bg-gray-800 hover:text-white'}"
				>
					<span aria-hidden="true">{item.icon}</span>
					<span>{item.label}</span>
					{#if alert > 0}
						<span
							class="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-black text-white shadow-lg ring-2 ring-gray-950"
						>
							<span class="sr-only">ממתינים לטיפול:</span>{alert}
						</span>
					{:else if count > 0}
						<span class="rounded-full bg-black/25 px-1.5 py-0.5 text-[11px] font-bold">{count}</span
						>
					{/if}
				</a>
			{/each}
		</nav>
	{/if}

	{@render children()}
</div>
