<script>
	import { lang, translations } from '$lib/i18n';
	import Seo from '$lib/components/Seo.svelte';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { faqSchema } from '$lib/seo';
	import { FAQS } from '$lib/faqs';
	// שתי הלשוניות — אודות ותנאי הקהילה — הן גוף העמוד. כפתור "מידע" שבכותרת
	// מוביל לכאן; עד כה הוא פתח את אותו תוכן בחלון צף מעל הדף.
	import InfoTabs from '$lib/components/InfoTabs.svelte';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang]);
</script>

<Seo
	title="מידע: אודות האינדקס, תנאי הקהילה ותו התקן | בעלי מקצוע כשירים"
	description="איך עובד אינדקס בעלי המקצוע הכשירים, שאלות נפוצות, תנאי הקהילה — כללי הרישום, אמנת הקהילה, חוות דעת ודירוגים — ותו התקן של יוצאים לחירות: הפרמטרים לקבלתו, תוקפו והעילות לשלילתו."
	path="/policy"
/>
<!-- ה-FAQPage יושב כאן ולא בדף הבית: השאלות והתשובות עברו ללשונית "אודות",
     וגוגל דורש שהסכימה תשקף טקסט שגלוי בפועל באותו עמוד. -->
<JsonLd data={[faqSchema(FAQS)]} />

<!-- כרטיס כהה על רקע האתר, כמו דף המסמכים המשפטיים (/about/legal): הכרטיס
     הלבן שישב כאן היה שריד מהחלון הצף, וזרח כמלבן לבן בתוך אתר כהה. -->
<div class="px-4 py-8 sm:px-6 sm:py-12 lg:px-8" dir={t.dir}>
	<div
		class="mx-auto max-w-4xl rounded-3xl border border-purple-500/25 bg-gray-900/70 p-6 shadow-2xl backdrop-blur-sm sm:p-12"
	>
		<a
			href="/"
			class="group mb-10 inline-flex items-center gap-2 font-bold text-blue-400 transition-colors hover:text-blue-300"
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

		<InfoTabs />
	</div>
</div>
