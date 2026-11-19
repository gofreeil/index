/**
 * קומה מתקפלת בדף הפרופיל: לחיצה על הכותרת מקפלת את הקומה לשורת הכותרת בלבד,
 * ולחיצה נוספת פותחת אותה. המצב נשמר בדפדפן לכל קומה (לפי ה-id של המקטע).
 *
 * שימוש: <section id="ads" use:collapsibleFloor> — הפעולה מוצאת את ה-h2 הראשון,
 * ושורת הכותרת היא ה-h2 עצמו, או העוטף הישיר שלו אם הוא עוטף כפתורי צד
 * (למשל "+ מודעה חדשה"). לחיצה על קישור/כפתור בשורה לא מקפלת.
 *
 * ההסתרה עצמה היא CSS ב-layout.css (section[data-collapsed] > :not(.floor-head)),
 * ולכן היא עובדת גם על תוכן שנטען או משתנה אחרי ההרכבה.
 *
 * פתיחה מבחוץ: אירוע 'floor-expand' על המקטע (אריח בפאנל הניהול), או קפיצה
 * לעוגן #id (הבועה שעל האווטאר, השיתוף החכם) — הקומה נפתחת לפני שנוחתים בה.
 */

const KEY = 'floor-collapsed:';

function readCollapsed(id: string): boolean {
	try {
		return localStorage.getItem(KEY + id) === '1';
	} catch {
		return false;
	}
}

function writeCollapsed(id: string, collapsed: boolean) {
	try {
		if (collapsed) localStorage.setItem(KEY + id, '1');
		else localStorage.removeItem(KEY + id);
	} catch {
		// מצב פרטי / אחסון חסום — המצב פשוט לא יישמר בין ביקורים
	}
}

export function collapsibleFloor(node: HTMLElement) {
	const h2 = node.querySelector('h2');
	if (!h2) return;

	// שורת הכותרת: העוטף הישיר של ה-h2 אם הוא ילד ישיר של המקטע, אחרת ה-h2 עצמו
	const parent = h2.parentElement;
	const head: HTMLElement = parent && parent !== node && parent.parentElement === node ? parent : h2;
	head.classList.add('floor-head');
	head.setAttribute('role', 'button');
	head.tabIndex = 0;
	head.title = 'לחיצה מקפלת או פותחת את הקומה';

	// חץ בתחילת הכותרת; מסתובב לפי המצב (ב-CSS)
	const chevron = document.createElement('span');
	chevron.className = 'floor-chevron';
	chevron.setAttribute('aria-hidden', 'true');
	chevron.textContent = '▾';
	h2.prepend(chevron);

	const id = node.id;

	function set(collapsed: boolean, persist = true) {
		if (collapsed) node.setAttribute('data-collapsed', '');
		else node.removeAttribute('data-collapsed');
		head.setAttribute('aria-expanded', String(!collapsed));
		if (persist && id) writeCollapsed(id, collapsed);
	}

	const isTarget = () => !!id && location.hash === '#' + id;
	// מי שהגיע בקישור ישיר לקומה רואה אותה פתוחה, גם אם קיפל אותה בעבר
	set(id && !isTarget() ? readCollapsed(id) : false, false);

	function onClick(e: Event) {
		// קישורים, כפתורים וטפסים בשורת הכותרת עושים את שלהם ולא מקפלים
		if ((e.target as Element).closest('a, button, input, select, textarea, label')) return;
		set(!node.hasAttribute('data-collapsed'));
	}

	function onKey(e: KeyboardEvent) {
		if (e.target !== head) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			set(!node.hasAttribute('data-collapsed'));
		}
	}

	const expand = () => set(false);
	const onHash = () => {
		if (isTarget()) set(false);
	};

	head.addEventListener('click', onClick);
	head.addEventListener('keydown', onKey);
	node.addEventListener('floor-expand', expand);
	window.addEventListener('hashchange', onHash);

	return {
		destroy() {
			head.removeEventListener('click', onClick);
			head.removeEventListener('keydown', onKey);
			node.removeEventListener('floor-expand', expand);
			window.removeEventListener('hashchange', onHash);
			chevron.remove();
		}
	};
}
