<script>
	import { lang, translations } from '$lib/i18n';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang]);
</script>

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

		<div
			class="space-y-10 leading-relaxed text-gray-700 {t.dir === 'rtl'
				? 'text-right'
				: 'text-left'}"
		>
			<p
				class="rounded-xl border-blue-500 bg-blue-50 p-4 text-lg font-medium text-blue-900 {t.dir ===
				'rtl'
					? 'border-r-4'
					: 'border-l-4'}"
			>
				{t.policyPromise}
			</p>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection1}
				</h2>
				<p class="{t.dir === 'rtl' ? 'pr-9' : 'pl-9'} text-lg">
					<a
						href="https://www.melecshop.com/page/uecc"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-600 underline decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-800 hover:decoration-blue-500"
					>
						{t.policySection1Text}
					</a>
				</p>
			</section>

			<section
				class="rounded-2xl border-yellow-200 bg-yellow-50/50 p-6 {t.dir === 'rtl'
					? 'border-r-4'
					: 'border-l-4'}"
			>
				<h2 class="flex items-center gap-3 text-2xl font-black text-yellow-800">
					<span class="text-3xl">🪙</span>
					{t.policyCashTitle}
				</h2>
				<p class="mt-4 text-xl leading-relaxed font-bold text-yellow-900">
					"{t.policyCashText}"
				</p>
			</section>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection2}
				</h2>
				<p class="{t.dir === 'rtl' ? 'pr-9' : 'pl-9'} text-lg">{t.policySection2Text}</p>
			</section>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection3}
				</h2>
				{#if currentLang === 'he'}
					<ul class="list-disc space-y-2 pr-14 text-lg">
						<li>ההטבה המוצעת חייבת להיות משמעותית, אמיתית ולא שיווקית בלבד.</li>
						<li>אין להציג “הנחה” שאינה משקפת מחיר אמיתי או מחירון קיים.</li>
						<li>ההטבה צריכה להיות מכובדת בפועל ללא תנאים נסתרים.</li>
					</ul>
				{:else}
					<p class="{t.dir === 'rtl' ? 'pr-9' : 'pl-9'} text-lg">
						The offer must be significant, genuine, and not just for marketing purposes.
					</p>
				{/if}
			</section>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection4}
				</h2>
				{#if currentLang === 'he'}
					<ul class="list-disc space-y-2 pr-14 text-lg">
						<li>בעלי העסקים מתחייבים להעניק שירות מקצועי, מכבד ואחראי.</li>
						<li>אין להפלות, להטעות או לנצל את הפלטפורמה לצרכים שאינם תואמים את רוח הקהילה.</li>
						<li>במקרים של עומס או זמינות מוגבלת — יש ליידע את הלקוח מראש.</li>
					</ul>
				{:else}
					<p class="{t.dir === 'rtl' ? 'pr-9' : 'pl-9'} text-lg">
						Business owners commit to providing professional, respectful, and responsible service.
					</p>
				{/if}
			</section>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection5}
				</h2>
				<p class="rounded-lg bg-gray-50 p-4 text-lg italic {t.dir === 'rtl' ? 'pr-9' : 'pl-9'}">
					{#if currentLang === 'he'}
						בעל העסק אחראי לאיכות השירות, למוצרים ולתנאי העבודה שלו. הקהילה אינה צד בעסקה ואינה
						אחראית לנזקים, תקלות או אי־התאמות — האחריות היא של נותן השירות בלבד.
					{:else}
						The business owner is responsible for the quality of service, products, and working
						conditions. The community is not a party to the transaction and is not responsible for
						any damages or discrepancies.
					{/if}
				</p>
			</section>

			<section class="space-y-4">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection6}
				</h2>
				<p
					class="mb-4 text-lg font-bold underline decoration-blue-200 underline-offset-4 {t.dir ===
					'rtl'
						? 'pr-9'
						: 'pl-9'}"
				>
					{#if currentLang === 'he'}
						בעלי העסקים המשתתפים במאגר פועלים ברוח הערכים של יוצאים לחירות:
					{:else}
						Participating businesses operate in the spirit of Yotzim L'cherut values:
					{/if}
				</p>
				{#if currentLang === 'he'}
					<ul class="list-disc space-y-2 pr-14 text-lg">
						<li>חירות ועצמאות</li>
						<li>הוגנות ושקיפות</li>
						<li>ביזור כוח וחיזוק עסקים קטנים</li>
						<li>ערבות הדדית ושיתוף פעולה</li>
						<li>אפשרות לשימוש במזומן תמיד לכל מי שמגיע לעסק</li>
						<li>נכונות לדיון בבתי הדין/ פיוס של יוצאים לחירות</li>
					</ul>
				{:else}
					<ul class="list-disc space-y-2 text-lg {t.dir === 'rtl' ? 'pr-14' : 'pl-14'}">
						<li>Liberty and independence</li>
						<li>Fairness and transparency</li>
						<li>Mutual guarantee and cooperation</li>
						<li>Always allowing cash payments</li>
					</ul>
				{/if}
				<p
					class="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 {t.dir === 'rtl'
						? 'pr-9'
						: 'pl-9'} font-bold text-red-600"
				>
					{#if currentLang === 'he'}
						עסק הפועל בניגוד לערכים אלו עשוי להיות מוסר מהמאגר ופרטי הפרתו יפורסמו באתר לתמיד.
					{:else}
						A business operating contrary to these values may be removed from the directory, and
						details of its violation will be published on the site permanently.
					{/if}
				</p>
			</section>

			<section class="space-y-4 border-b border-gray-100 pb-8">
				<h2 class="flex items-center gap-3 text-2xl font-bold text-gray-900">
					<span class="text-blue-600">🟦</span>
					{t.policySection7}
				</h2>
				<p class="mb-2 text-lg {t.dir === 'rtl' ? 'pr-9' : 'pl-9'}">
					{#if currentLang === 'he'}
						הקהילה שומרת לעצמה את הזכות להסיר עסק מהמאגר במקרים של:
					{:else}
						The community reserves the right to remove a business from the directory in cases of:
					{/if}
				</p>
				{#if currentLang === 'he'}
					<ul class="list-disc space-y-2 pr-14 text-lg">
						<li>הפרת המדיניות</li>
						<li>תלונות חוזרות מצד חברי הקהילה</li>
						<li>הטבות פיקטיביות</li>
						<li>הטבות שאינן מכובדות בפועל</li>
						<li>התנהלות שאינה תואמת את ערכי התנועה</li>
						<li>חוסר הסכמה לקבל מזומן (בהגעה לבית העסק)</li>
						<li>חוסר הסכמה להתדיין בבתי הפיוס/ דין של יוצאים לחירות</li>
					</ul>
				{:else}
					<ul class="list-disc space-y-2 text-lg {t.dir === 'rtl' ? 'pr-14' : 'pl-14'}">
						<li>Policy violation</li>
						<li>Repeated complaints from community members</li>
						<li>Fictitious benefits</li>
						<li>Benefits not honored in practice</li>
						<li>Conduct inconsistent with the movement's values</li>
						<li>Refusal to accept cash (when visiting the business)</li>
						<li>Refusal to engage in mediation/arbitration by Yotzim L'cherut courts</li>
					</ul>
				{/if}
				<p class="mt-4 {t.dir === 'rtl' ? 'pr-9' : 'pl-9'} font-bold text-gray-900">
					{#if currentLang === 'he'}
						הסרה תתבצע כמובן לאחר בירור הוגן ושקוף.
					{:else}
						Removal will, of course, be carried out after a fair and transparent investigation.
					{/if}
				</p>
			</section>

			<footer class="pt-8">
				<h3 class="mb-4 text-2xl font-black text-blue-700">
					✨ {currentLang === 'he' ? 'לסיכום' : 'In Summary'}
				</h3>
				<p class="text-xl font-medium text-gray-800 italic">
					{t.policySummary}
				</p>
			</footer>
		</div>
	</div>
</div>
