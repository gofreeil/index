<script>
	// תיבת אישור תנאי הקהילה — אותה תיבה בכל דלת שמובילה לבעלות על
	// כרטיסייה (ראו $lib/terms.js). המשפט משתנה לפי ההקשר, שם השדה לא.
	//
	// הקישור לתנאים הוא שורה נפרדת ולא קישור בתוך המשפט: המשפט מתורגם
	// לשלוש שפות, וקישור שמפצל אותו לשלושה חלקים היה נשבר בכל אחת מהן.
	import { TERMS_FIELD, TERMS_LINK } from '$lib/terms.js';

	/** @type {{
	 *   text: string,
	 *   linkLabel?: string,
	 *   checked?: boolean,
	 *   error?: string,
	 *   required?: boolean,
	 *   name?: string,
	 *   textClass?: string
	 * }} */
	let {
		text,
		linkLabel = 'קריאת תנאי הקהילה',
		checked = $bindable(false),
		error = '',
		required = true,
		name = TERMS_FIELD,
		// ברירת המחדל היא הרקע הכהה של האתר; האזור האישי (בהיר/כהה) דורס
		textClass = 'text-gray-300'
	} = $props();
</script>

<div>
	<label class="flex items-start gap-2.5 text-sm leading-6 {textClass}">
		<!-- בלי name התיבה אינה נשלחת: כך משתמש אותה מדור שבו האישור יושב
		     מחוץ לטופס ונוסע איתו בשדה מוסתר (האזור האישי) -->
		<input
			type="checkbox"
			name={name || undefined}
			{required}
			bind:checked
			class="mt-1 h-4 w-4 shrink-0 accent-blue-600"
		/>
		<span>{text}</span>
	</label>
	<a
		href={TERMS_LINK}
		target="_blank"
		rel="noopener"
		class="mt-1 inline-block ps-7 text-xs font-bold text-blue-400 underline underline-offset-2 transition hover:text-blue-300"
	>
		{linkLabel} ←
	</a>
	{#if error}
		<p class="mt-1 ps-7 text-xs font-bold text-red-400">{error}</p>
	{/if}
</div>
