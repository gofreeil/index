<script>
	/* ═══════════ תג הוותק ═══════════
	   כמה זמן בעל העסק אצלנו, נספר מיום שהכרטיסייה עלתה לאתר (ראו tenure.js).
	   זהו סימן אמון כמו הדירוג, ולכן הוא יושב לצדו ולא בשורה משלו.

	   בחודש הראשון מוצג "חדש באתר" ולא "0 חודשים": משך אפס אינו ותק, ו"חדש"
	   הוא גם ניסוח מזמין ולא הודאה בחיסרון. אין חותמת תקינה = אין תג בכלל,
	   ולא מציין מקום ריק. */

	import { lang, translations } from '$lib/i18n';
	import { tenureInfo } from '$lib/tenure.js';

	/**
	 * @type {{
	 *   since?: string,
	 *   size?: 'sm' | 'md'
	 * }}
	 */
	let { since = '', size = 'md' } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));
	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const info = $derived(tenureInfo(since, currentLang));
	const SIZES = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-0.5 text-xs' };
</script>

{#if info}
	<span
		class="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 font-bold text-amber-300 {SIZES[
			size
		] || SIZES.md}"
		title={info.since ? t.tenureSince.replace('{date}', info.since) : ''}
	>
		<span aria-hidden="true">🎖️</span>
		{#if info.isNew}
			{t.tenureNew}
		{:else}
			{t.tenureLabel} · {info.text}
		{/if}
	</span>
{/if}
