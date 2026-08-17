<script>
	// גוף מדיניות הקהילה — לשונית "תנאי הקהילה" שבעמוד /policy.
	// הכותרת הראשית לא נמצאת כאן בכוונה: היא ה-<h1> של הלשונית, ו-h1 כפול
	// באותו עמוד היה מבלבל את גוגל לגבי נושא הדף.
	import { lang, translations } from '$lib/i18n';

	// רמת הכותרות של הסעיפים — h2, מתחת ל-h1 של הלשונית, כך שהיררכיית
	// הכותרות נשארת רציפה.
	/** @type {{ headingTag?: 'h2' | 'h3' }} */
	let { headingTag = 'h2' } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);
</script>

<!-- הסעיפים מסודרים כרשת כרטיסים — שתי עמודות במסך רחב, עמודה אחת במובייל —
     במקום טור ארוך אחד, כדי שהעמוד ייקרא בלי גלילה ארוכה. הזוגות בסדר הקריאה
     מאוזנים באורכם: (קוד אתי, מזומן), (הטבה, פיוס), (ערכים, הסרה). -->
<div
	class="space-y-5 leading-relaxed text-gray-300 {t.dir === 'rtl' ? 'text-right' : 'text-left'}"
>
	<p
		class="rounded-xl border-blue-400 bg-blue-500/10 p-4 text-lg font-medium text-blue-100 {t.dir ===
		'rtl'
			? 'border-r-4'
			: 'border-l-4'}"
	>
		{t.policyPromise}
	</p>

	<div class="grid gap-4 sm:grid-cols-2">
		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policySection1}
			</svelte:element>
			<p>
				{#if currentLang === 'he'}
					{t.policySection1Text}
					<a
						href="https://www.melecshop.com/page/uecc"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
					>
						{t.policySection1LinkName}
					</a>
				{:else}
					Acceptance of the Global Ethical Code based on the 7 Noahide Laws.
				{/if}
			</p>
		</section>

		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policyCashTitle}
			</svelte:element>
			<p>
				{t.policyCashText}
			</p>
		</section>

		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policySection2}
			</svelte:element>
			{#if currentLang === 'he'}
				<ul class="list-disc space-y-1 pr-5">
					<li>ההטבה המוצעת חייבת להיות משמעותית, אמיתית ולא שיווקית בלבד.</li>
					<li>אין להציג “הנחה” שאינה משקפת מחיר אמיתי או מחירון קיים.</li>
					<li>ההטבה צריכה להיות מכובדת בפועל ללא תנאים נסתרים.</li>
				</ul>
			{:else}
				<p>The offer must be significant, genuine, and not just for marketing purposes.</p>
			{/if}
		</section>

		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policySection3}
			</svelte:element>
			<p>
				{#if currentLang === 'he'}
					אם חלילה יש טענה של הלקוח, בעל העסק מתחייב להתדיין בבתי הפיוס / דין של יוצאים לחירות,
					ניתן לעשות זאת גם בצורה וירטואלית פרטים כאן:
					<a
						href="https://chachmim.gofreeil.com/"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
					>
						בתי הפיוס
					</a>
				{:else}
					In case of disputes, business owners commit to mediation in "Yotzim L'cherut" courts.
				{/if}
			</p>
		</section>

		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policySection4}
			</svelte:element>
			<p class="mb-2 font-bold underline decoration-blue-400/50 underline-offset-4">
				{#if currentLang === 'he'}
					בעלי העסקים המשתתפים במאגר פועלים ברוח הערכים של יוצאים לחירות:
				{:else}
					Participating businesses operate in the spirit of Yotzim L'cherut values:
				{/if}
			</p>
			{#if currentLang === 'he'}
				<ul class="list-disc space-y-1 pr-5">
					<li>חירות ועצמאות</li>
					<li>הוגנות ושקיפות</li>
					<li>אחריות עסקית הן למוצריו הן לשרותיו</li>
					<li>ביזור כוח וחיזוק עסקים קטנים</li>
					<li>ערבות הדדית ושיתוף פעולה</li>
					<li>אפשרות לשימוש במזומן תמיד לכל מי שמגיע לעסק</li>
					<li>נכונות לדיון בבתי הדין/ פיוס של יוצאים לחירות</li>
				</ul>
			{:else}
				<ul class="list-disc space-y-1 {t.dir === 'rtl' ? 'pr-5' : 'pl-5'}">
					<li>Liberty and independence</li>
					<li>Fairness and transparency</li>
					<li>Mutual guarantee and cooperation</li>
					<li>Always allowing cash payments</li>
				</ul>
			{/if}
			<p class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 font-bold text-red-300">
				{#if currentLang === 'he'}
					עסק הפועל בניגוד לערכים אלו עשוי להיות מוסר מהמאגר ופרטי הפרתו יפורסמו באתר לתמיד.
				{:else}
					A business operating contrary to these values may be removed from the directory, and
					details of its violation will be published on the site permanently.
				{/if}
			</p>
		</section>

		<section class="rounded-xl border border-white/10 bg-white/5 p-4">
			<svelte:element
				this={headingTag}
				class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-100"
			>
				<span class="text-blue-400">🟦</span>
				{t.policySection5}
			</svelte:element>
			<p class="mb-2">
				{#if currentLang === 'he'}
					הקהילה שומרת לעצמה את הזכות להסיר עסק מהמאגר במקרים של:
				{:else}
					The community reserves the right to remove a business from the directory in cases of:
				{/if}
			</p>
			{#if currentLang === 'he'}
				<ul class="list-disc space-y-1 pr-5">
					<li>הפרת המדיניות</li>
					<li>תלונות חוזרות מצד חברי הקהילה</li>
					<li>הטבות פיקטיביות</li>
					<li>הטבות שאינן מכובדות בפועל</li>
					<li>התנהלות שאינה תואמת את ערכי התנועה</li>
					<li>חוסר הסכמה לקבל מזומן (בהגעה לבית העסק)</li>
					<li>חוסר הסכמה להתדיין בבתי הפיוס/ דין של יוצאים לחירות</li>
				</ul>
			{:else}
				<ul class="list-disc space-y-1 {t.dir === 'rtl' ? 'pr-5' : 'pl-5'}">
					<li>Policy violation</li>
					<li>Repeated complaints from community members</li>
					<li>Fictitious benefits</li>
					<li>Benefits not honored in practice</li>
					<li>Conduct inconsistent with the movement's values</li>
					<li>Refusal to accept cash (when visiting the business)</li>
					<li>Refusal to engage in mediation/arbitration by Yotzim L'cherut courts</li>
				</ul>
			{/if}
			<p class="mt-3 font-bold text-gray-100">
				{#if currentLang === 'he'}
					הסרה תתבצע כמובן לאחר בירור הוגן ושקוף.
				{:else}
					Removal will, of course, be carried out after a fair and transparent investigation.
				{/if}
			</p>
		</section>
	</div>

	<footer class="border-t border-white/10 pt-4">
		<p class="text-lg font-medium text-gray-200 italic">
			<span class="font-black text-blue-300 not-italic"
				>✨ {currentLang === 'he' ? 'לסיכום:' : 'In Summary:'}</span
			>
			{t.policySummary}
		</p>
	</footer>
</div>
