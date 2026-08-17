<script>
	// דף המידע — שלוש לשוניות מעל אותו תוכן: "אודות", "תנאי הקהילה" ו"תו התקן".
	// עד כאן הרכיב הוצג בשני מצבים (עמוד /policy וחלון צף שנפתח מהכותרת);
	// החלון הצף בוטל, והמידע חי בעמוד מלא אחד בלבד.
	//
	// כל הפאנלים נמצאים תמיד ב-DOM והלא-פעיל מוסתר ב-CSS ולא ב-{#if}: כך
	// כל התוכן מגיע לגוגל ב-HTML הראשון של /policy, ולא רק הלשונית שנפתחת
	// כברירת מחדל.
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';
	import AboutContent from './AboutContent.svelte';
	import PolicyContent from './PolicyContent.svelte';
	import StandardMarkContent from './StandardMarkContent.svelte';

	/** @typedef {'about' | 'terms' | 'standard'} TabId */

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	/** @type {TabId} */
	let active = $state('about');

	const ABOUT_TITLE = 'אינדקס בעלי מקצוע כשירים — איך זה עובד';

	/** @type {{ id: TabId, label: string, icon: string }[]} */
	const tabs = $derived([
		{ id: /** @type {TabId} */ ('about'), label: t.aboutTab, icon: 'ℹ️' },
		{ id: /** @type {TabId} */ ('terms'), label: t.termsTab, icon: '📋' },
		{ id: /** @type {TabId} */ ('standard'), label: t.standardTab, icon: '🏅' }
	]);

	// ה-hash הוא קישור-עומק ללשונית (/policy#terms), וגם משמר אותה ברענון.
	onMount(() => {
		const hash = window.location.hash.slice(1);
		if (hash === 'about' || hash === 'terms' || hash === 'standard') active = hash;
	});

	/** @param {TabId} id */
	function setTab(id) {
		active = id;
		history.replaceState(null, '', '#' + id);
	}
</script>

<div dir={t.dir}>
	<!-- המידות הקומפקטיות בנייד נחוצות כדי ששלוש הלשוניות ייכנסו בשורה אחת
	     גם במסך צר (כ-280px פנוי בתוך הכרטיס). -->
	<div
		class="mb-8 flex flex-wrap gap-1.5 border-b border-white/10 pb-4 sm:gap-2"
		role="tablist"
		aria-label={t.info}
	>
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id="info-tab-{tab.id}"
				aria-selected={active === tab.id}
				aria-controls="info-panel-{tab.id}"
				onclick={() => setTab(tab.id)}
				class="flex items-center gap-1 rounded-full border px-2.5 py-2 text-xs font-bold whitespace-nowrap transition-all sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base {active ===
				tab.id
					? 'border-purple-400/60 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
					: 'border-white/10 bg-white/5 text-gray-300 hover:border-blue-500/40 hover:bg-white/10 hover:text-white'}"
			>
				<span aria-hidden="true">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>

	<div
		id="info-panel-about"
		role="tabpanel"
		aria-labelledby="info-tab-about"
		class:hidden={active !== 'about'}
	>
		<header class="mb-10 border-b border-white/10 pb-8">
			<div class="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
				<img
					src="/logo-professionals.png?v=4"
					alt="לוגו בעלי מקצוע כשירים — סדר בכל עניין"
					class="h-24 w-auto rounded-2xl object-contain shadow-lg sm:h-32"
				/>
				<h1
					class="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
				>
					{ABOUT_TITLE}
				</h1>
			</div>
		</header>
		<AboutContent />
	</div>

	<div
		id="info-panel-terms"
		role="tabpanel"
		aria-labelledby="info-tab-terms"
		class:hidden={active !== 'terms'}
	>
		<header class="mb-6 border-b border-white/10 pb-5">
			<h1
				class="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
			>
				{t.communityPolicyTitle}
			</h1>
			<p class="mt-3 text-lg leading-relaxed text-gray-300">
				{t.policyIntro}
			</p>
		</header>
		<PolicyContent />
	</div>

	<div
		id="info-panel-standard"
		role="tabpanel"
		aria-labelledby="info-tab-standard"
		class:hidden={active !== 'standard'}
	>
		<header class="mb-10 border-b border-white/10 pb-8">
			<h1
				class="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
			>
				תו התקן של יוצאים לחירות
			</h1>
			<p class="mt-6 text-xl leading-relaxed text-gray-300">
				הסימון הגבוה ביותר באינדקס — מוענק לעסקים שקיבלו 5 כוכבים מהקהילה ועמדו בפרמטרים שלהלן.
			</p>
		</header>
		<StandardMarkContent />
	</div>
</div>
