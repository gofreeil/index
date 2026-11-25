<script>
	import { buildNewBusinessWhatsapp, buildWhatsappShareUrl } from '$lib/adminWhatsapp.js';

	/** @type {{ business: any, compact?: boolean }} */
	let { business, compact = false } = $props();

	let open = $state(false);
	let copied = $state(false);
	/** @type {string | null} */
	let edited = $state(null);

	const generated = $derived(buildNewBusinessWhatsapp(business));
	const text = $derived(edited ?? generated);
	const waUrl = $derived(buildWhatsappShareUrl(text));

	async function copyText() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			/* דפדפן חסם clipboard — הטקסט גלוי בעריכה להעתקה ידנית */
		}
	}
</script>

<button
	type="button"
	onclick={() => (open = !open)}
	class={compact
		? 'rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-950/50'
		: 'rounded-lg border border-emerald-500/40 px-3.5 py-1.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-950/50'}
	aria-expanded={open}
>
	💬 {open ? 'סגור ווצאפ' : 'ווצאפ לקבוצה'}
</button>

{#if open}
	<div class="mt-2 basis-full rounded-xl border border-emerald-500/30 bg-gray-950/70 p-3" dir="rtl">
		<div class="mb-2 flex items-center justify-between gap-2 text-xs text-emerald-300/90">
			<span class="font-bold">📢 הודעת ווצאפ מוכנה לשליחה</span>
			{#if edited !== null}
				<button
					type="button"
					onclick={() => (edited = null)}
					class="text-gray-400 underline hover:text-gray-200"
				>
					איפוס לנוסח המקורי
				</button>
			{/if}
		</div>
		<textarea
			rows="8"
			value={text}
			oninput={(e) => (edited = e.currentTarget.value)}
			class="w-full rounded-lg border border-gray-700 bg-gray-900 p-2.5 text-xs leading-relaxed text-gray-100 focus:border-emerald-500/60 focus:outline-none"
		></textarea>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<a
				href={waUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
			>
				💬 פתח בווצאפ
			</a>
			<button
				type="button"
				onclick={copyText}
				class="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-bold text-gray-200 transition hover:bg-gray-800"
			>
				{copied ? '✓ הועתק' : '📋 העתק הודעה'}
			</button>
			<button
				type="button"
				onclick={() => (open = false)}
				class="ms-auto text-xs text-gray-500 hover:text-gray-300"
			>
				סגור
			</button>
		</div>
	</div>
{/if}
