import { fail } from '@sveltejs/kit';
import { createReport } from '$lib/server/strapi.js';

/** @type {Map<string, {count:number, resetAt:number}>} */
const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** @param {string} ip */
function rateLimited(ip) {
	const now = Date.now();
	const b = buckets.get(ip);
	if (!b || now > b.resetAt) {
		buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}
	if (b.count >= MAX_PER_WINDOW) return true;
	b.count += 1;
	return false;
}

const REASONS = ['no_discount', 'cash_refused', 'ethics', 'other'];
/** @param {FormDataEntryValue|null} v */
const str = (v) => (typeof v === 'string' ? v.trim() : '');

export const actions = {
	default: async ({ request, getClientAddress, locals }) => {
		const fd = await request.formData();
		if (str(fd.get('company_website'))) return { success: true }; // honeypot
		const renderedAt = Number(fd.get('form_rendered_at'));
		if (renderedAt && Date.now() - renderedAt < 3000) {
			return fail(400, { error: 'הטופס נשלח מהר מדי, נסו שוב.' });
		}
		if (rateLimited(getClientAddress())) {
			return fail(429, { error: 'נשלחו יותר מדי דיווחים. נסו שוב מאוחר יותר.' });
		}

		const business_name = str(fd.get('business_name'));
		const reason = str(fd.get('reason'));
		const details = str(fd.get('details'));
		const reporter_name = str(fd.get('reporter_name'));
		const reporter_contact = str(fd.get('reporter_contact'));

		/** @type {Record<string,string>} */
		const errors = {};
		if (!business_name) errors.business_name = 'יש לציין את שם העסק';
		if (!REASONS.includes(reason)) errors.reason = 'יש לבחור סיבת דיווח';
		if (!details) errors.details = 'יש לפרט את הדיווח';
		if (Object.keys(errors).length) {
			return fail(400, {
				errors,
				values: { business_name, reason, details, reporter_name, reporter_contact }
			});
		}

		try {
			await createReport({
				business_name,
				reason,
				details: details.slice(0, 4000),
				reporter_name: reporter_name.slice(0, 120),
				reporter_contact: reporter_contact.slice(0, 200),
				status: 'pending',
				source: 'index-report-form'
			});
		} catch (e) {
			console.error('createReport failed:', e);
			return fail(502, { error: 'שליחת הדיווח נכשלה. נסו שוב עוד רגע.' });
		}
		return { success: true };
	}
};
