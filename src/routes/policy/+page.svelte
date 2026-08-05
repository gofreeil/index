<script>
	import { lang, translations } from '$lib/i18n';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { faqSchema } from '$lib/seo';
	import { FAQS } from '$lib/faqs';
	// אותן שתי לשוניות שמוצגות בחלון המידע שבכותרת — מקור אחד לשניהם.
	import InfoTabs from '$lib/components/InfoTabs.svelte';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang]);
</script>

<Seo
	title="מידע: אודות האינדקס ותנאי הקהילה | בעלי מקצוע כשירים"
	description="איך עובד אינדקס בעלי המקצוע הכשירים, שאלות נפוצות, ותנאי הקהילה: כללי הרישום לבעלי מקצוע, אמנת הקהילה, כתיבת חוות דעת ודירוגים, והאחריות על ההתקשרות בין הלקוח לבעל המקצוע."
	path="/policy"
/>
<!-- ה-FAQPage יושב כאן ולא בדף הבית: השאלות והתשובות עברו ללשונית "אודות",
     וגוגל דורש שהסכימה תשקף טקסט שגלוי בפועל באותו עמוד. -->
<JsonLd data={[faqSchema(FAQS)]} />

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

		<InfoTabs variant="page" />
	</div>
</div>
