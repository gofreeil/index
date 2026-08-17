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
		>. כל בעל מקצוע שמופיע כאן חתם על <strong>אמנת הקהילה</strong>:
	</p>
	<ul class="space-y-2 text-lg">
		<li class="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
			<strong>שירות</strong> — התחייבות לשירות אמין, עם אחריות על העבודה. לצורך זה בעלי המקצוע
			מדורגים על ידי חברינו ומקבלים חוות דעת פומביות, כך שהבחירה נעשית לפי ניסיון אמיתי של
			משתמשים — ולא לפי מי שקנה את המקום הראשון בפרסום.
		</li>
		<li class="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
			<strong>מחיר</strong> — התחייבות להנחה או הטבה ייחודית, רק לנו.
		</li>
		<li class="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
			<strong>שמירה על זכות המזומן</strong> — התחייבות לקבל תשלום במזומן, ולתמיד.
		</li>
		<li class="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
			<strong>קובלנה</strong> — התחייבות להישפט ב<a
				href="https://chachmim.gofreeil.com/"
				target="_blank"
				rel="noopener noreferrer"
				class="text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
				>בתי הפיוס</a
			> שלנו במקרה שיש ללקוח תלונה או סכסוך כלפי השירות.
		</li>
		<li class="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
			<strong>אמנת המוסר העולמית</strong> — כל מי שמופיע כאן חתום על
			<a
				href="https://www.melecshop.com/page/uecc"
				target="_blank"
				rel="noopener noreferrer"
				class="text-blue-400 underline decoration-blue-500/60 underline-offset-4 transition-colors hover:text-blue-300 hover:decoration-blue-400"
				>הקוד האתי המוסרי העולמי (UECC)</a
			>.
		</li>
	</ul>
	<p class="text-lg">
		הפנייה היא <strong>ישירה לבעל המקצוע</strong> — בלי תיווך ובלי עמלה.
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
