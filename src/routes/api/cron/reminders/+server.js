import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sendTodayReminderSms } from '$lib/server/reminderSms.js';

// נקרא ע"י Vercel Cron כל בוקר (ראו vercel.json) — SMS לכל בעל עסק
// עם התזכורות של היום מ"למי שלחתי". ?force=1 עוקף את מניעת הכפילות.
// אבטחה: אם הוגדר CRON_SECRET, נדרש Authorization: Bearer <secret>.
export async function GET({ request, url }) {
	const secret = (env.CRON_SECRET ?? '').trim();
	if (secret) {
		const auth = request.headers.get('authorization') ?? '';
		if (auth !== `Bearer ${secret}`) throw error(401, 'unauthorized');
	}
	try {
		const result = await sendTodayReminderSms({ force: url.searchParams.get('force') === '1' });
		return json({ ok: true, ...result });
	} catch (e) {
		console.error('[cron/reminders] failed:', e);
		return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
	}
}
