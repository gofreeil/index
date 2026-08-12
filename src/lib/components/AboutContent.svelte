<script>
	// לשונית "אודות" שבדף המידע (/policy) — ההסבר על האינדקס והשאלות הנפוצות.
	// ישב עד כה בתחתית דף הבית; הועבר לכאן כדי שכל המידע על האתר יהיה במקום אחד.
	// הטקסט בעברית בלבד, כפי שהיה בדף הבית: זהו תוכן ארוך ולא מחרוזת ממשק,
	// והוא לא עובר דרך $lib/i18n.
	import { FAQS } from '$lib/faqs';

	// רמת הכותרות של הסעיפים — h2, מתחת ל-h1 של הלשונית.
	/** @type {{ headingTag?: 'h2' | 'h3' }} */
	let { headingTag = 'h2' } = $props();
</script>

<div class="space-y-5 text-right leading-relaxed text-gray-300">
	<p class="text-lg">
		<strong>בעלי מקצוע כשירים</strong> הוא אינדקס בעלי המקצוע של רשת
		<a
			href="https://gofreeil.com"
			target="_blank"
			rel="noopener noreferrer"
			class="text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
			>יוצאים לחירות</a
		>. כל בעל מקצוע שמופיע כאן חתם על <strong>אמנת הקהילה</strong> — מחיר הוגן, שירות אמין ואחריות
		על העבודה — והתחייב ל<strong>הנחה או הטבה ייחודית</strong> לחברי הקהילה. הלקוחות מדרגים את בעלי המקצוע
		וכותבים חוות דעת, כך שהבחירה נעשית לפי ניסיון אמיתי של שכנים ולא לפי מי שקנה את המקום הראשון בפרסום.
	</p>
	<p class="text-lg">
		באינדקס תמצאו <strong>חשמלאים</strong>, <strong>אינסטלטורים</strong>,
		<strong>שיפוצניקים</strong>, טכנאי <strong>מזגנים</strong> ומוצרי חשמל,
		<strong>הובלות</strong>, טכנאי <strong>מחשבים</strong> ואבטחת מידע, <strong>עורכי דין</strong>
		ושירותים פיננסיים, <strong>אוכל ומזון</strong> ואירועים, <strong>יופי וטיפוח</strong>,
		<strong>בריאות ותזונה</strong>, טיפול וייעוץ, חוגים ופנאי ובייביסיטר — בכל הארץ. הפנייה היא
		ישירה לבעל המקצוע, בלי תיווך ובלי עמלה.
	</p>
	<p class="text-lg">
		בעל מקצוע?
		<a
			href="/submit-business"
			class="font-bold text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
			>הגישו את העסק לאינדקס</a
		>
		וקבלו דף עסק שמופיע בגוגל, עם תיאור, אזור שירות, דירוגים וקישור ישיר לוואטסאפ.
	</p>

	<section class="space-y-4 pt-4">
		<svelte:element this={headingTag} class="text-2xl font-bold text-gray-100">
			שאלות נפוצות
		</svelte:element>
		<div class="space-y-2">
			{#each FAQS as f (f.q)}
				<details class="rounded-xl border border-white/10 bg-white/5 px-4">
					<summary class="cursor-pointer py-3 font-bold text-gray-100">{f.q}</summary>
					<p class="pb-3 leading-relaxed text-gray-400">{f.a}</p>
				</details>
			{/each}
		</div>
	</section>
</div>

<style>
	/* המילים המודגשות בגוף הטקסט — לבנות יותר מהטקסט סביבן, אחרת על רקע כהה
	   ההדגשה כמעט נבלעת. כלל אחד במקום מחלקה על כל <strong> בטקסט הארוך. */
	strong {
		color: #f3f4f6;
	}
</style>
