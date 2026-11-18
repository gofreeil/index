<script>
	// ─────────────────────────────────────────────────────────────
	// FloorPanel — "פאנל ניהול" בדף הפרופיל: אריח לכל קומה (מקטע) בדף, עם
	// סיכום קצר שלה, ולחיצה גוללת אליה. אותו דפוס כמו קיצורי הקומות באתר
	// "קהילה בשכונה". הקומות עצמן מוגדרות בדף (רק הקיימות למשתמש), והעוגן של
	// כל אחת הוא ה-id של המקטע. ההדר הדביק מטופל ב-scroll-padding-top של ה-html.
	// ─────────────────────────────────────────────────────────────

	/**
	 * @typedef {{ id: string, icon: string, title: string, summary: string, alert?: number }} Floor
	 */

	/** @type {{ floors: Floor[] }} */
	let { floors } = $props();

	/** @param {MouseEvent} e @param {string} id */
	function go(e, id) {
		const el = document.getElementById(id);
		// אין יעד בדף (מקטע שלא נטען) — מאפשרים לקישור לעשות את שלו
		if (!el) return;
		e.preventDefault();
		const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
		// הבהוב קצר על הקומה שהגענו אליה, כדי שיהיה ברור לאן נחתנו
		el.classList.remove('floor-flash');
		void el.offsetWidth; // מפעיל מחדש את האנימציה בלחיצה חוזרת
		el.classList.add('floor-flash');
		setTimeout(() => el.classList.remove('floor-flash'), 1700);
	}
</script>

<nav
	aria-label="פאנל ניהול"
	class="w-full rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
	<div class="mb-2 flex flex-wrap items-baseline gap-x-2">
		<h2 class="text-sm font-extrabold text-gray-900 dark:text-gray-100">🧭 פאנל ניהול</h2>
		<span class="text-[11px] text-gray-500 dark:text-gray-400">לחצו על קומה כדי לקפוץ אליה</span>
	</div>

	<ul class="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
		{#each floors as f (f.id)}
			<li class="min-w-0">
				<a
					href="#{f.id}"
					onclick={(e) => go(e, f.id)}
					class="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-700/30 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20"
				>
					{#if f.alert}
						<span
							class="absolute -top-1.5 -left-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-black text-white shadow ring-2 ring-white dark:ring-gray-800"
						>
							<span class="sr-only">ממתינים לטיפול: </span>{f.alert}
						</span>
					{/if}
					<span class="text-lg leading-none" aria-hidden="true">{f.icon}</span>
					<span class="min-w-0">
						<span class="block truncate text-xs font-bold text-gray-900 dark:text-gray-100">
							{f.title}
						</span>
						<span class="block truncate text-[11px] text-gray-500 dark:text-gray-400">
							{f.summary}
						</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/* ההבהוב רץ על המקטע בדף (לא על רכיב זה), ולכן :global */
	:global(.floor-flash) {
		animation: floorFlash 1.6s ease-out;
	}
	@keyframes floorFlash {
		0% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
		}
		25% {
			box-shadow:
				0 0 0 3px rgba(59, 130, 246, 0.55),
				0 0 28px 6px rgba(59, 130, 246, 0.35);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.floor-flash) {
			animation: none;
		}
	}
</style>
