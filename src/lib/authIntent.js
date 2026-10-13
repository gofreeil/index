// "הבקשה הראשונה" של מי שנשלח להירשם/להתחבר באמצע פעולה.
//
// אורח שלוחץ על פעולה שדורשת חשבון נשלח להתחברות עם יעד חזרה (?returnTo=). בסיום
// ההרשמה/התחברות הוא נוחת ביעד עם ?welcome=..., ומסך הפתיחה (WelcomeScreen) מציג:
// "השלמת את ההרשמה! כעת תועבר לבקשתך הראשונה — <תיאור>" ונסגר אל הבקשה עצמה.
// תיאור יש רק ליעדים שהם פעולה; דף הבית, דפי עיון והאזור האישי אינם "בקשה".

/** @type {Array<[RegExp, string]>} */
const ROUTE_LABELS = [
	[/^\/business\/[^/]+\/edit$/, 'עריכת כרטיס העסק'],
	[/^\/advertise(\/|$)/, 'בניית מודעה'],
	[/^\/admin(\/|$)/, 'ממשק הניהול']
];

/**
 * תיאור הבקשה לפי נתיב היעד (כולל query), או null כשהיעד אינו בקשה
 * @param {string} pathAndSearch
 * @returns {string | null}
 */
export function describeReturn(pathAndSearch) {
	let url;
	try {
		url = new URL(pathAndSearch, 'http://x');
	} catch {
		return null;
	}
	const path = url.pathname.replace(/\/+$/, '') || '/';
	if (/^\/business\/[^/]+$/.test(path)) {
		if (url.searchParams.get('intent') === 'review') return 'כתיבת ביקורת על העסק';
		if (url.searchParams.get('claim') === '1') return 'שיוך כרטיס העסק אליך';
	}
	for (const [re, label] of ROUTE_LABELS) if (re.test(path)) return label;
	return null;
}
