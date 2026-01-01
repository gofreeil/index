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

		<header
			class="mb-12 border-b border-gray-100 pb-8 {t.dir === 'rtl' ? 'text-right' : 'text-left'}"
		>
			<h1
				class="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-3xl leading-tight font-black text-transparent sm:text-5xl"
			>
				{t.privacyPolicyTitle}
			</h1>
			<p class="mt-6 text-lg leading-relaxed text-gray-600">
				{t.lastUpdated}
				{new Date().toLocaleDateString(currentLang === 'he' ? 'he-IL' : 'en-US')}
			</p>
		</header>

		<div
			class="space-y-10 leading-relaxed text-gray-700 {t.dir === 'rtl'
				? 'text-right'
				: 'text-left'}"
		>
			<section class="space-y-4">
				<h2 class="border-b-2 border-blue-100 pb-2 text-2xl font-bold text-gray-900">
					{t.privacySection1}
				</h2>
				<p class="text-lg">
					{t.privacyIntro}
				</p>
			</section>

			<section class="space-y-4">
				<h2 class="border-b-2 border-blue-100 pb-2 text-2xl font-bold text-gray-900">
					{t.privacySection2}
				</h2>
				{#if currentLang === 'he'}
					<ul class="list-disc space-y-2 pr-6 text-lg">
						<li>
							<strong>מידע על בעלי עסקים:</strong> שם העסק, פרטי התקשרות, תמונות, מיקום ותיאור השירות.
						</li>
						<li>
							<strong>חוות דעת ודירוגים:</strong> מידע שמשתמשים בוחרים לפרסם אודות עסקים.
						</li>
						<li>
							<strong>מידע טכני:</strong> כתובת IP ונתוני שימוש אנונימיים.
						</li>
					</ul>
				{:else}
					<ul class="list-disc space-y-2 {t.dir === 'rtl' ? 'pr-6' : 'pl-6'} text-lg">
						<li>
							<strong>Business Owner Information:</strong> Name, contact details, photos, location.
						</li>
						<li>
							<strong>Reviews & Ratings:</strong> Information users choose to publish about businesses.
						</li>
						<li><strong>Technical Information:</strong> IP address and anonymous usage data.</li>
					</ul>
				{/if}
			</section>

			<section class="space-y-4">
				<h2 class="border-b-2 border-blue-100 pb-2 text-2xl font-bold text-gray-900">
					{t.privacySection3}
				</h2>
				<p class="text-lg">
					{currentLang === 'he'
						? 'אנו משתמשים במידע למטרות הבאות בלבד:'
						: 'We use the information for the following purposes only:'}
				</p>
				<ul class="list-disc space-y-2 {t.dir === 'rtl' ? 'pr-6' : 'pl-6'} text-lg">
					{#if currentLang === 'he'}
						<li>הצגת העסקים במדריך וחיבורם לחברי הקהילה.</li>
						<li>יצירת קשר עם בעלי עסקים בנוגע לרישומם.</li>
						<li>שיפור ותחזוקת האתר.</li>
					{:else}
						<li>
							Displaying businesses in the directory and connecting them to community members.
						</li>
						<li>Contacting business owners regarding their registration.</li>
						<li>Improving and maintaining the site.</li>
					{/if}
				</ul>
			</section>

			<section class="space-y-4">
				<h2 class="border-b-2 border-blue-100 pb-2 text-2xl font-bold text-gray-900">
					{t.privacySection4}
				</h2>
				<p class="text-lg">
					{#if currentLang === 'he'}
						התנועה אינה מוכרת או משכירה מידע אישי לצדדים שלישיים.
					{:else}
						The movement does not sell or rent personal information to third parties.
					{/if}
				</p>
			</section>

			<section class="space-y-4">
				<h2 class="border-b-2 border-blue-100 pb-2 text-2xl font-bold text-gray-900">
					{t.privacySection5}
				</h2>
				<p class="text-lg">
					{#if currentLang === 'he'}
						אנו נוקטים באמצעי זהירות מקובלים כדי להגן על המידע שברשותנו.
					{:else}
						We take accepted precautions to protect the information in our possession.
					{/if}
				</p>
			</section>

			<footer class="border-t border-gray-100 pt-8">
				<p class="text-xl font-medium text-gray-800 italic">
					{t.privacyFooter}
					<a href="mailto:support@melecshop.com" class="text-blue-600 hover:underline"
						>support@melecshop.com</a
					>
				</p>
			</footer>
		</div>
	</div>
</div>
