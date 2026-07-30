<script>
	import Seo from '$lib/components/Seo.svelte';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { formDraft, clearDraft, resumeDraft } from '$lib/formDraft';

	/** @type {{ form: any }} */
	let { form } = $props();

	let submitting = $state(false);
	let renderedAt = $state(0);
	onMount(() => (renderedAt = Date.now()));

	// טיוטה אוטומטית — דיווח מפורט שנכתב ולא נשלח לא הולך לאיבוד.
	// חותמת הזמן וה-honeypot שייכים לשליחה הנוכחית ולכן לא נשמרים.
	const DRAFT_KEY = 'index-report';
	const DRAFT_EXCLUDE = ['form_rendered_at', 'company_website'];
	let draftRestored = $state(false);
	/** @type {HTMLFormElement | null} */
	let formEl = $state(null);

	function discardDraft() {
		clearDraft(DRAFT_KEY);
		resumeDraft(DRAFT_KEY);
		formEl?.reset();
		draftRestored = false;
	}

	const v = $derived(form?.values ?? {});
	const errors = $derived(form?.errors ?? {});

	const REASONS = [
		{ value: 'no_discount', label: 'העסק לא נתן את ההטבה שהובטחה לחברי הקהילה' },
		{ value: 'cash_refused', label: 'העסק סירב לקבל תשלום במזומן' },
		{ value: 'ethics', label: 'הפרת הקוד האתי / ערכי הקהילה' },
		{ value: 'other', label: 'אחר' }
	];
</script>

<Seo
	title="דיווח על עסק - מדריך בעלי מקצוע כשירים"
	description="טופס דיווח על עסק באינדקס בעלי המקצוע."
	path="/report"
	noindex
/>

<main class="mx-auto max-w-xl px-4 py-10 sm:px-6" dir="rtl">
	{#if form?.success}
		<div class="rounded-3xl border border-green-500/30 bg-green-900/10 p-10 text-center shadow-xl">
			<div class="mb-4 text-6xl">🕊️</div>
			<h1 class="mb-3 text-2xl font-black text-green-400">הדיווח התקבל</h1>
			<p class="mx-auto mb-8 max-w-md leading-relaxed text-gray-300">
				תודה. הדיווח יטופל בדיסקרטיות על-ידי צוות האינדקס. שמירה על מרחב עסקי הוגן היא באחריות כולנו.
			</p>
			<a
				href="/"
				class="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:scale-105"
				>חזרה למדריך</a
			>
		</div>
	{:else}
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-extrabold text-red-400 sm:text-4xl">דיווח על עסק</h1>
			<p class="mt-3 text-sm leading-relaxed text-gray-400">
				עסק במדריך שמפר את מדיניות הקהילה? דווחו לנו. הדיווח חסוי ומטופל על-ידי צוות האינדקס.
			</p>
		</div>

		{#if form?.error}
			<div class="mb-6 rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-center text-red-300">
				{form.error}
			</div>
		{/if}

		{#if draftRestored}
			<div class="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-green-500/30 bg-green-900/20 px-4 py-3 text-sm text-green-200">
				<span class="font-bold">💾 שחזרנו את מה שמילאת קודם — הטופס ממשיך מהמקום שעצרת.</span>
				<button type="button" onclick={discardDraft}
					class="rounded-full border border-green-500/40 bg-green-900/40 px-3 py-1 text-xs font-bold text-green-100 transition hover:bg-green-800/50">
					התחל מטופס ריק
				</button>
			</div>
		{/if}

		<form
			bind:this={formEl}
			method="POST"
			use:formDraft={{ key: DRAFT_KEY, exclude: DRAFT_EXCLUDE, onRestore: () => (draftRestored = true) }}
			use:enhance={() => {
				submitting = true;
				return async ({ result, update }) => {
					if (result.type === 'redirect' || result.type === 'success') clearDraft(DRAFT_KEY);
					await update();
					submitting = false;
				};
			}}
			class="space-y-5 rounded-2xl border border-gray-800 bg-gray-900/40 p-6"
		>
			<input
				type="text"
				name="company_website"
				tabindex="-1"
				autocomplete="off"
				class="absolute right-[-9999px] h-0 w-0 opacity-0"
				aria-hidden="true"
			/>
			<input type="hidden" name="form_rendered_at" value={renderedAt} />

			<div>
				<label for="business_name" class="mb-1 block text-sm font-medium text-gray-300"
					>שם העסק המדווח *</label
				>
				<input id="business_name" name="business_name" required defaultValue={v.business_name ?? ''} class="field" />
				{#if errors.business_name}<p class="err">{errors.business_name}</p>{/if}
			</div>

			<div>
				<label for="reason" class="mb-1 block text-sm font-medium text-gray-300">סיבת הדיווח *</label>
				<select id="reason" name="reason" required class="field">
					<option value="" disabled selected={!v.reason}>בחרו…</option>
					{#each REASONS as r}
						<option value={r.value} selected={v.reason === r.value}>{r.label}</option>
					{/each}
				</select>
				{#if errors.reason}<p class="err">{errors.reason}</p>{/if}
			</div>

			<div>
				<label for="details" class="mb-1 block text-sm font-medium text-gray-300">פירוט *</label>
				<textarea id="details" name="details" required rows="4" class="field">{v.details ?? ''}</textarea>
				{#if errors.details}<p class="err">{errors.details}</p>{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="reporter_name" class="mb-1 block text-sm font-medium text-gray-300"
						>שמך (לא חובה)</label
					>
					<input id="reporter_name" name="reporter_name" defaultValue={v.reporter_name ?? ''} class="field" />
				</div>
				<div>
					<label for="reporter_contact" class="mb-1 block text-sm font-medium text-gray-300"
						>ליצירת קשר (לא חובה)</label
					>
					<input id="reporter_contact" name="reporter_contact" defaultValue={v.reporter_contact ?? ''} class="field" />
				</div>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-full bg-gradient-to-r from-red-600 to-pink-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
			>
				{submitting ? 'שולח…' : 'שליחת הדיווח'}
			</button>
		</form>
	{/if}
</main>

<style>
	.field {
		width: 100%;
		border-radius: 0.6rem;
		border: 1px solid #374151;
		background: #1f2937;
		padding: 0.55rem 0.75rem;
		color: #f3f4f6;
		outline: none;
	}
	.field:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}
	.err {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: #f87171;
	}
</style>
