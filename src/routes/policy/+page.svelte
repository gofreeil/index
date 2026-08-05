<script>
	import { lang, translations } from '$lib/i18n';
	import Seo from '$lib/components/Seo.svelte';
	// אותו גוף מדיניות שמוצג בחלון המידע שבכותרת — מקור אחד לשניהם.
	import PolicyContent from '$lib/components/PolicyContent.svelte';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang]);
</script>

<Seo
	title="תנאי שימוש ומדיניות האתר | בעלי מקצוע כשירים"
	description="תנאי השימוש באינדקס בעלי המקצוע הכשירים: כללי הרישום לבעלי מקצוע, אמנת הקהילה, כתיבת חוות דעת ודירוגים, והאחריות על ההתקשרות בין הלקוח לבעל המקצוע."
	path="/policy"
/>

<div class="px-4 py-12 sm:px-6 lg:px-8" dir={t.dir}>
	<div class="mx-auto max-w-4xl rounded-3xl border border-gray-100 bg-white p-8 shadow-2xl sm:p-16">
		<a
			href="/"
			class="group mb-12 inline-flex items-center gap-2 font-bold text-blue-600 transition-colors hover:text-blue-800"
		>
			<svg
				class="h-5 w-5 {t.dir === 'rtl'
					? 'rotate-180'
					: ''} transition-transform group-hover:-translate-x-1"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			{t.policyBack}
		</a>

		<header class="mb-12 border-b border-gray-100 pb-8">
			<h1
				class="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
			>
				{t.communityPolicyTitle}
			</h1>
			<p class="mt-6 text-xl leading-relaxed text-gray-600">
				{t.policyIntro}
			</p>
		</header>

		<PolicyContent />
	</div>
</div>
