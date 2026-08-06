// ============================================================
// adminNav.js — מקור אמת יחיד למסכי פאנל הניהול ולהרשאות שלהם.
// פורט מהגמ"ח הארצי (src/lib/adminNav.ts) והותאם למבנה של האינדקס:
// כאן ארבעה מהמסכים הם לשוניות בתוך /admin (?tab=...), ולכן לפריט יש
// גם path וגם tab — הבדיקה מי "פעיל" נשענת על שניהם.
//
// שני צרכנים: סרגל הניווט של /admin (admin/+layout.svelte), והפאנל
// הפרוס בתוך האזור האישי (/profile#admin) — כדי שרשימת המסכים והגבלות
// התפקיד לא יתפצלו לשני מקומות.
//
// הקובץ נטען גם בדפדפן — אסור לייבא לכאן מודולי $lib/server.
// ============================================================

/**
 * @typedef {Object} AdminNavItem
 * @property {string} href     הקישור המלא (כולל ?tab= אם צריך)
 * @property {string} path     הנתיב בלי query — לבדיקת "פעיל"
 * @property {string} [tab]    ערך ה-tab, למסכים שהם לשונית בתוך /admin
 * @property {string} icon
 * @property {string} label    תווית קצרה — לסרגל הניווט
 * @property {string} title    כותרת מלאה — לאריח בפאנל הפרוס
 * @property {string} desc     משפט הסבר — לאריח בפאנל הפרוס
 * @property {'businesses'|'reviews'|'reports'|'ads'|'claims'} [alert] איזה מונה-המתנה שייך למסך
 * @property {'all'} [count]   מונה "כמה נתונים יש" (לא התראה)
 * @property {boolean} [navOnly] מוצג רק בסרגל הניווט — לא כאריח באזור האישי
 */

/**
 * המסכים שהמשתמש רשאי לראות.
 * @param {boolean} isAdmin
 * @param {boolean} [superAdmin]
 * @returns {AdminNavItem[]}
 */
export function adminNav(isAdmin, superAdmin = false) {
	if (!isAdmin) return [];

	return [
		{
			href: '/admin?tab=pending',
			path: '/admin',
			tab: 'pending',
			icon: '⏳',
			label: 'ממתינים',
			title: 'ממתינים לאישור',
			desc: 'עסקים חדשים שנשלחו וממתינים לאישור',
			alert: 'businesses'
		},
		{
			href: '/admin/claims',
			path: '/admin/claims',
			icon: '🪪',
			label: 'בעלות',
			title: 'בעלות על כרטיסיות',
			desc: 'בקשות "זה העסק שלי" והתאמות שהמערכת מצאה',
			alert: 'claims'
		},
		{
			href: '/admin?tab=cards',
			path: '/admin',
			tab: 'cards',
			icon: '🏪',
			label: 'כרטיסיות',
			title: 'ניהול כרטיסיות',
			desc: 'עריכה, הקפאה, שחזור ומחיקה',
			count: 'all'
		},
		{
			href: '/admin?tab=reviews',
			path: '/admin',
			tab: 'reviews',
			icon: '⭐',
			label: 'ביקורות',
			title: 'ביקורות',
			desc: 'אישור ודחייה של ביקורות גולשים',
			alert: 'reviews'
		},
		{
			href: '/admin?tab=reports',
			path: '/admin',
			tab: 'reports',
			icon: '🚩',
			label: 'דיווחים',
			title: 'דיווחים',
			desc: 'תלונות על הפרת ההטבה או הקוד האתי',
			alert: 'reports'
		},
		{
			href: '/admin/ads',
			path: '/admin/ads',
			icon: '📢',
			label: 'פרסומות',
			title: 'ניהול פרסומות',
			desc: 'אישור מודעות, לוח תפוסה ונתוני מפרסמים',
			alert: 'ads'
		},
		{
			// באזור האישי הנתונים כבר פרוסים בכרטיס הסטטיסטיקה הפתוח — אריח מיותר
			href: '/admin/stats',
			path: '/admin/stats',
			icon: '📈',
			label: 'סטטיסטיקה',
			title: 'סטטיסטיקה',
			desc: 'כניסות, כרטיסיות נצפות, ערים ומקורות תנועה',
			navOnly: true
		},
		...(superAdmin
			? [
					{
						href: '/admin/admins',
						path: '/admin/admins',
						icon: '🔑',
						label: 'אדמינים',
						title: 'ניהול אדמינים',
						desc: 'מינוי אדמינים והסרת הרשאות'
					}
				]
			: [])
	];
}

/** האריחים לפאנל הפרוס באזור האישי — בלי מה שמסומן לניווט בלבד.
 * @param {boolean} isAdmin @param {boolean} [superAdmin] @returns {AdminNavItem[]} */
export function adminTiles(isAdmin, superAdmin = false) {
	return adminNav(isAdmin, superAdmin).filter((item) => !item.navOnly);
}

/**
 * האם פריט הניווט הוא המסך הנוכחי.
 * @param {AdminNavItem} item
 * @param {string} pathname
 * @param {string|null} tab הלשונית הפעילה כרגע (רק כשהמסך הוא /admin)
 */
export function isActiveNav(item, pathname, tab) {
	if (item.tab) return pathname === item.path && (tab || 'pending') === item.tab;
	return pathname === item.path || pathname.startsWith(item.path + '/');
}
