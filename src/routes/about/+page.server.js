import { redirect } from '@sveltejs/kit';

// דף "אודותינו" של האתר חי בדף המידע (/policy, לשונית "אודות") יחד עם
// השאלות והתשובות וסכמת ה-FAQPage. /about הוא הכתובת המקובלת בכל אתרי
// הרשת, ולכן מפנה לשם באופן קבוע (301) במקום לשכפל את התוכן.
export function load() {
	redirect(301, '/policy#about');
}
