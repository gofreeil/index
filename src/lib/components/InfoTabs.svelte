<script>
	// דף המידע — שתי לשוניות מעל אותו תוכן, בשני מקומות תצוגה:
	// variant="page"  → עמוד /policy (כותרת h1, סעיפים h2)
	// variant="modal" → החלון שנפתח מכפתור "מידע" שבכותרת (בלי כותרת פנימית,
	//                   כי כותרת החלון ולשוניות הניווט כבר אומרות במה מדובר; סעיפים h3)
	//
	// שני הפאנלים נמצאים תמיד ב-DOM והלא-פעיל מוסתר ב-CSS ולא ב-{#if}: כך
	// גם התנאים וגם האודות מגיעים לגוגל ב-HTML הראשון של /policy, ולא רק
	// הלשונית שנפתחת כברירת מחדל.
	import { onMount } from 'svelte';
	import { lang, translations } from '$lib/i18n';
	import AboutContent from './AboutContent.svelte';
	import PolicyContent from './PolicyContent.svelte';

	/** @typedef {'about' | 'terms'} TabId */

	/** @type {{ variant?: 'page' | 'modal', active?: TabId }} */
	let { variant = 'page', active = $bindable('about') } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const isPage = $derived(variant === 'page');
	/** @type {'h2' | 'h3'} */
	const sectionTag = $derived(isPage ? 'h2' : 'h3');

	const ABOUT_TITLE = 'אינדקס בעלי מקצוע כשירים — איך זה עובד';

	/** @type {{ id: TabId, label: string, icon: string }[]} */
	const tabs = $derived([
		{ id: /** @type {TabId} */ ('about'), label: t.aboutTab, icon: 'ℹ️' },
		{ id: /** @type {TabId} */ ('terms'), label: t.termsTab, icon: '📋' }
	]);

	// בעמוד המלא ה-hash הוא קישור-עומק ללשונית (/policy#terms), וגם משמר את
	// הלשונית ברענון. בחלון הקופץ אין נגיעה ב-URL, כדי לא לשבור את כפתור "אחורה".
	onMount(() => {
		if (!isPage) return;
		const hash = window.location.hash.slice(1);
		if (hash === 'about' || hash === 'terms') active = hash;
	});

	/** @param {TabId} id */
	function setTab(id) {
		active = id;
		if (isPage) history.replaceState(null, '', '#' + id);
	}
</script>

<div dir={t.dir}>
	<div
		class="mb-8 flex flex-wrap gap-2 border-b border-gray-100 pb-4"
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
				class="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all sm:text-base {active ===
				tab.id
					? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
					: 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}"
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
		{#if isPage}
			<header class="mb-10 border-b border-gray-100 pb-8">
				<h1
					class="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
				>
					{ABOUT_TITLE}
				</h1>
			</header>
		{/if}
		<AboutContent headingTag={sectionTag} />
	</div>

	<div
		id="info-panel-terms"
		role="tabpanel"
		aria-labelledby="info-tab-terms"
		class:hidden={active !== 'terms'}
	>
		<header class={isPage ? 'mb-10 border-b border-gray-100 pb-8' : 'mb-8'}>
			{#if isPage}
				<h1
					class="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
				>
					{t.communityPolicyTitle}
				</h1>
			{/if}
			<p class="{isPage ? 'mt-6 text-xl' : 'text-base'} leading-relaxed text-gray-600">
				{t.policyIntro}
			</p>
		</header>
		<PolicyContent headingTag={sectionTag} />
	</div>
</div>
