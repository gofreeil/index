<script>
	// חלון המידע של מדיניות הקהילה — נפתח מכפתור המידע שבכותרת ומציג את
	// מדיניות הקהילה במלואה בלי לעזוב את הדף הנוכחי.
	// התוכן נטען רק כשהחלון פתוח: כך אין שכפול של כל טקסט המדיניות בכל דף
	// באתר (משקל מיותר לדפדפן, ותוכן כפול בעיני גוגל).
	import { lang, translations } from '$lib/i18n';
	import PolicyContent from './PolicyContent.svelte';

	/** @type {{ open?: boolean }} */
	let { open = $bindable(false) } = $props();

	let currentLang = $state('he');
	lang.subscribe((v) => (currentLang = v));

	const t = $derived(/** @type {any} */ (translations)[currentLang] || translations.he);

	const close = () => (open = false);

	/** @param {KeyboardEvent} e */
	const onKeydown = (e) => {
		if (e.key === 'Escape') close();
	};

	// נעילת גלילת הרקע כל עוד החלון פתוח, כדי שהגלילה תפעל על תוכן המדיניות.
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="policy-modal-title"
		tabindex="-1"
		dir={t.dir}
		onclick={close}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="my-4 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<header
				class="sticky top-0 z-10 flex items-start gap-4 border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-md sm:px-10"
			>
				<div class="min-w-0 flex-1">
					<h2
						id="policy-modal-title"
						class="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-xl leading-tight font-black text-transparent sm:text-3xl"
					>
						{t.communityPolicyTitle}
					</h2>
					<p class="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
						{t.policyIntro}
					</p>
				</div>
				<button
					type="button"
					onclick={close}
					class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
					aria-label={currentLang === 'he' ? 'סגירה' : 'Close'}
				>
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</header>

			<div class="px-6 py-8 sm:px-10">
				<PolicyContent headingTag="h3" />

				<div class="mt-8 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-6">
					<a
						href="/policy"
						class="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
					>
						{currentLang === 'he' ? 'פתיחה בעמוד נפרד' : 'Open as a full page'}
					</a>
					<button
						type="button"
						onclick={close}
						class="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50"
					>
						{currentLang === 'he' ? 'סגירה' : 'Close'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
