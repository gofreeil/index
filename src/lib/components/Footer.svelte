<script>
	import { lang, translations } from '$lib/i18n';

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const year = new Date().getFullYear();
</script>

<footer class="mt-1 border-t border-white/10 bg-[#0d1117] py-0 md:mt-0 md:py-2">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex flex-col items-center justify-between gap-0 md:flex-row md:gap-6">
			<!-- ימין: תמונת המותג + טקסט -->
			<a
				href="https://gofreeil.com/"
				target="_blank"
				rel="noopener noreferrer"
				aria-label={t.freedomLinkAria}
				style="cursor: pointer;"
				class="flex items-center gap-3 transition-opacity hover:opacity-80"
			>
				<img
					src="/images/yotzim-lecherut.webp"
					alt={t.freedomMovement}
					class="h-28 w-28 flex-shrink-0 rounded-lg object-contain transition-transform hover:scale-105 md:h-32 md:w-32"
				/>

				<!-- מובייל: פריסה מקוצרת -->
				<div class="flex flex-col text-right text-sm leading-tight md:hidden">
					<p class="text-sm font-black text-yellow-400">
						{t.freedomMovement}
					</p>
					<p class="text-xs font-normal text-gray-300">
						{t.freedomTagline}
					</p>
				</div>

				<!-- דסקטופ -->
				<div class="hidden text-right leading-tight md:flex md:flex-col md:gap-1">
					<p class="text-base font-normal text-gray-300 md:text-lg">
						{t.freedomTagline}
					</p>
					<p
						class="flex items-center justify-end gap-2 text-lg font-black text-yellow-500 md:text-xl"
					>
						<span>👉</span>
						{t.freedomMovement}
					</p>
				</div>
			</a>

			<!-- מרכז: קישורים -->
			<!-- בנייד: רשת של שתי עמודות עם קווים מפרידים בין השורות ובין
			     שני הקישורים שבכל שורה — במקום מפרידי "|" של הדסקטופ, שבגלישה
			     היו נשארים יתומים בסוף שורה. הקווים לוגיים (border-s) כדי
			     שיישבו נכון גם ב-RTL וגם ב-LTR. בדסקטופ חוזרים לשורה אחת עם "|". -->
			<nav
				aria-label={t.footerNavAria}
				class="grid w-full max-w-full grid-cols-2 text-sm font-bold text-gray-300 md:flex md:w-auto md:flex-wrap md:items-center md:justify-center md:gap-x-4 md:gap-y-1.5 md:text-lg"
			>
				<a
					href="/about/legal"
					class="border-b border-white/10 py-2 text-center transition-colors hover:text-white md:border-0 md:py-0"
				>
					<span class="block md:hidden">{t.legalLinksL1} {t.legalLinksL2}</span>
					<span class="hidden whitespace-nowrap md:inline-block">{t.legalLinks}</span>
				</a>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a
					href="mailto:support@melecshop.com"
					class="border-s border-b border-white/10 py-2 text-center transition-colors hover:text-white md:border-0 md:py-0"
					aria-label={t.contactEmailAria}>{t.contact}</a
				>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a
					href="/about/advertise"
					class="col-span-2 border-b border-white/10 py-2 text-center transition-colors hover:text-white md:col-span-1 md:border-0 md:py-0"
					>{t.advertise}</a
				>
				<span class="hidden font-black text-gray-600 md:inline" aria-hidden="true">|</span>
				<a
					href="/report"
					class="col-span-2 max-w-full py-2 text-center text-red-500 transition-colors hover:text-red-300 md:py-0"
					>{t.reportViolation}</a
				>
			</nav>

			<!-- שמאל: זכויות יוצרים -->
			<p class="pb-4 text-center text-xs font-bold text-gray-400 md:pb-0 md:text-right md:text-lg">
				&copy; {year}
				{t.allRightsReserved}
			</p>
		</div>
	</div>
</footer>
