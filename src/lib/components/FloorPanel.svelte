<script>
	// ─────────────────────────────────────────────────────────────
	// FloorPanel — "פאנל ניהול" בדף הפרופיל: אריח לכל קומה (מקטע) בדף, עם
	// סיכום קצר שלה, ולחיצה גוללת אליה. אותו דפוס כמו קיצורי הקומות באתר
	// "קהילה בשכונה". הקומות עצמן מוגדרות בדף (רק הקיימות למשתמש), והעוגן של
	// כל אחת הוא ה-id של המקטע. ההדר הדביק מטופל ב-scroll-padding-top של ה-html.
	//
	// הרכיב מוטמע בתוך כרטיס הזהות (בלי מסגרת וצל משלו): מפריד דק מעליו,
	// וכל אריח מקבל צ'יפ אייקון. אריח עם התראה (alert) מודגש באדום עדין.
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

<nav aria-label="פאנל ניהול" class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
	<h2 class="mb-2.5 text-xl font-extrabold text-gray-900 dark:text-gray-100">🧭 פאנל ניהול</h2>

	<ul class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each floors as f (f.id)}
			<li class="min-w-0">
				<a
					href="#{f.id}"
					onclick={(e) => go(e, f.id)}
					class="relative flex h-full items-center gap-2.5 rounded-xl border bg-gradient-to-br px-2.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md {f.alert
						? 'border-red-200 from-red-50 to-white hover:border-red-300 dark:border-red-500/30 dark:from-red-950/30 dark:to-gray-800 dark:hover:border-red-400/50'
						: 'border-gray-200 from-gray-50 to-white hover:border-blue-300 dark:border-gray-700 dark:from-gray-700/40 dark:to-gray-800 dark:hover:border-blue-500/40'}"
				>
					{#if f.alert}
						<span
							class="absolute -top-1.5 -left-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs leading-none font-black text-white shadow ring-2 ring-white dark:ring-gray-800"
						>
							<span class="sr-only">ממתינים לטיפול: </span>{f.alert}
						</span>
					{/if}
					<span
						class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-2xl leading-none shadow-sm ring-1 ring-gray-200 dark:bg-gray-900/60 dark:ring-gray-700"
						aria-hidden="true">{f.icon}</span
					>
					<span class="min-w-0">
						<span
							class="block text-base leading-tight font-bold break-words text-gray-900 dark:text-gray-100"
						>
							{f.title}
						</span>
						<span class="block text-sm leading-tight break-words text-gray-500 dark:text-gray-400">
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
