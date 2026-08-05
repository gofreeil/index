<script>
	// דגל מדינה כתמונה מ-flagcdn ולא כאימוג'י.
	// אימוג'י של דגלים (🇮🇱) אינו נתמך ב-Windows: כרום שם מציג במקומו את שתי
	// אותיות הקוד ("IL"), ולכן בורר השפה נראה שבור אצל רוב הגולשים בדסקטופ.
	// אותו מקור דגלים משמש את שאר אתרי הרשת (groups.gofreeil.com), כדי שבורר
	// השפה ייראה זהה בכל האתרים.

	/** @type {{ code: string, label?: string, class?: string }} */
	let { code, label = '', class: klass = 'h-[18px] w-6' } = $props();
</script>

<img
	src="https://flagcdn.com/24x18/{code}.png"
	srcset="https://flagcdn.com/48x36/{code}.png 2x, https://flagcdn.com/72x54/{code}.png 3x"
	width="24"
	height="18"
	alt={label}
	loading="lazy"
	decoding="async"
	class="inline-block flex-shrink-0 rounded-[3px] object-cover shadow-sm ring-1 ring-black/10 {klass}"
/>
