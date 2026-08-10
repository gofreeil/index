import { fail, redirect } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { isSuperAdmin, listApprovedBusinesses, uploadImageMeta } from '$lib/server/strapi.js';
import { getCategorySettings, saveCategorySettings } from '$lib/server/categoryStore.js';
import { toBusiness } from '$lib/businessShape.js';
import {
	CATEGORY_DEFS,
	OTHER,
	effectiveCategories,
	normCategoryLabel,
	resolveCategory,
	sanitizeCategoryFit,
	isDefaultCategoryFit
} from '$lib/categories.js';

// מסך ניהול הקטגוריות — לסופר-אדמין בלבד. הרשימה שבקוד נשארת מקור האמת
// לסיווג; כאן נשמרות דריסות תצוגה (שם/אימוג'י/תמונה/סדר) וקטגוריות
// שנוספו מהמסך. הכול יושב ב-KV (ראו $lib/server/categoryStore.js).

const MAX_IMAGE_BYTES = 3_000_000;
const MAX_NAME = 40;
const MAX_ICON = 16; // אימוג'י מורכב (ZWJ) הוא כמה תווים

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!isSuperAdmin(locals.user)) throw redirect(302, '/admin');

	const [settings, rows] = await Promise.all([
		getCategorySettings(),
		listApprovedBusinesses().catch(() => [])
	]);
	const list = effectiveCategories(settings);

	// ספירת עסקים לכל קטגוריה — כדי שיהיה ברור מה חי במסילה ומה ריק.
	// המיפוי לפי נרמול: extra נספר גם דרך שמות קודמים (aliases).
	/** @type {Map<string, string>} */
	const keyByNorm = new Map();
	for (const c of list) {
		if (c.builtin) {
			keyByNorm.set(normCategoryLabel(c.key), c.key);
		} else {
			keyByNorm.set(normCategoryLabel(c.name), c.key);
			for (const a of c.aliases ?? []) keyByNorm.set(normCategoryLabel(a), c.key);
		}
	}
	/** @type {Record<string, number>} */
	const counts = {};
	/** @type {Record<string, number>} תוויות חופשיות שהוקלדו על כרטיסיות ואינן ברשימה */
	const freeLabels = {};
	for (const row of rows) {
		const canonical = resolveCategory(toBusiness(row));
		const key = keyByNorm.get(normCategoryLabel(canonical));
		if (key) counts[key] = (counts[key] ?? 0) + 1;
		else freeLabels[canonical] = (freeLabels[canonical] ?? 0) + 1;
	}

	let categories = list.map((c) => ({ ...c, count: counts[c.key] ?? 0 }));
	// בלי סדר ידני המסך מציג את הסדר האוטומטי של המסילה (לפי כמות, "אחר"
	// אחרון) — כך מה שרואים כאן הוא בדיוק מה שרואים בדף הבית, והזזה ראשונה
	// מתחילה מהמצב האמיתי
	if (!settings.order.length) {
		categories = [...categories].sort(
			(a, b) =>
				(a.key === OTHER ? 1 : 0) - (b.key === OTHER ? 1 : 0) ||
				b.count - a.count ||
				a.name.localeCompare(b.name, 'he')
		);
	}

	return { categories, freeLabels, hasCustomOrder: settings.order.length > 0 };
}

/**
 * שורה אחת מה-payload של הטופס. imageFit — מיקום+זום של התמונה באריח
 * (x/y אחוזי מיקוד, z זום; ראו sanitizeCategoryFit).
 * @typedef {{ key: string, name: string, icon: string, removeImage?: boolean, isNew?: boolean, imageFit?: unknown }} EditRow
 * ה-payload המלא: rows בסדר התצוגה + האם הסדר ידני. customOrder=false משאיר
 * את המסילה במיון האוטומטי לפי כמות — שמירה של שינוי-שם בלבד לא מקפיאה סדר.
 * @typedef {{ customOrder: boolean, rows: EditRow[] }} EditPayload
 */

/** @type {import('./$types').Actions} */
export const actions = {
	/**
	 * שמירת המצב המלא של המסך: סדר השורות = הסדר במסילה; שם/אימוג'י לכל
	 * שורה; תמונות מצורפות כקבצים img_<אינדקס>. קטגוריה שנוספה מקבלת מזהה
	 * x_... יציב; extra שנמחק מהרשימה פשוט לא נשלח — והעסקים שלו חוזרים
	 * להופיע תחת התווית שנשמרה אצלם במאגר.
	 */
	save: async ({ request, locals }) => {
		if (!isSuperAdmin(locals.user)) return fail(403, { error: 'פעולה זו לסופר-אדמין בלבד' });

		const fd = await request.formData();
		/** @type {EditPayload} */
		let payload;
		try {
			payload = JSON.parse(String(fd.get('payload') || ''));
			if (!payload || !Array.isArray(payload.rows)) throw new Error('bad payload');
		} catch {
			return fail(400, { error: 'הטופס נשלח פגום — רעננו את הדף ונסו שוב' });
		}
		const rows = payload.rows;
		if (rows.length > 60) return fail(400, { error: 'יותר מדי קטגוריות' });

		const current = await getCategorySettings();
		const extrasByKey = new Map(current.extras.map((x) => [x.key, x]));
		const builtinByLabel = new Map(CATEGORY_DEFS.map((d) => [d.label, d]));

		// ── ולידציה ──
		const canonicalNorms = new Set(CATEGORY_DEFS.map((d) => normCategoryLabel(d.label)));
		/** @type {Set<string>} */
		const seenNames = new Set();
		/** @type {Set<string>} */
		const seenBuiltins = new Set();
		for (const r of rows) {
			r.name = String(r.name ?? '').trim();
			r.icon = String(r.icon ?? '').trim();
			r.key = String(r.key ?? '');
			if (!r.name) return fail(400, { error: 'לכל קטגוריה חייב להיות שם' });
			if (r.name.length > MAX_NAME) {
				return fail(400, { error: `שם קטגוריה ארוך מדי (עד ${MAX_NAME} תווים): "${r.name}"` });
			}
			if (r.icon.length > MAX_ICON) {
				return fail(400, { error: `האימוג'י של "${r.name}" ארוך מדי` });
			}
			const n = normCategoryLabel(r.name);
			if (seenNames.has(n)) return fail(400, { error: `השם "${r.name}" מופיע פעמיים` });
			seenNames.add(n);

			if (builtinByLabel.has(r.key)) {
				seenBuiltins.add(r.key);
			} else {
				if (!r.isNew && !extrasByKey.has(r.key)) {
					return fail(400, { error: 'הרשימה השתנתה בינתיים — רעננו את הדף ונסו שוב' });
				}
				// קטגוריה מהמסך לא יכולה לשאת תווית קנונית של מובנית — היא הייתה
				// מצלה על המיפוי של הרשומות הקיימות (גם כשהמובנית שינתה שם תצוגה)
				if (canonicalNorms.has(n)) {
					return fail(400, {
						error: `"${r.name}" הוא שם של קטגוריה מובנית — ערכו אותה במקום להוסיף חדשה`
					});
				}
			}
		}
		// כל הקטגוריות המובנות חייבות להישאר — אי אפשר למחוק מה שמוגדר בקוד
		if (seenBuiltins.size !== CATEGORY_DEFS.length) {
			return fail(400, { error: 'חסרה קטגוריה מובנית — רעננו את הדף ונסו שוב' });
		}

		// ── העלאת תמונות (לפי אינדקס השורה בטופס) ──
		/** @type {Map<number, string>} */
		const uploadedByIndex = new Map();
		for (let i = 0; i < rows.length; i++) {
			const file = fd.get(`img_${i}`);
			if (!file || typeof file === 'string' || file.size === 0) continue;
			if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) {
				return fail(400, { error: `התמונה של "${rows[i].name}" חייבת להיות קובץ תמונה עד 3MB` });
			}
			const up = await uploadImageMeta(file).catch(() => null);
			if (!up) return fail(502, { error: `העלאת התמונה של "${rows[i].name}" נכשלה, נסו שוב` });
			uploadedByIndex.set(i, up.url);
		}

		// ── בניית ההגדרות החדשות ──
		/** @type {import('$lib/categories.js').CategorySettings} */
		const next = { order: [], overrides: {}, extras: [] };

		rows.forEach((r, i) => {
			if (builtinByLabel.has(r.key)) {
				const def = /** @type {{label:string, icon:string}} */ (builtinByLabel.get(r.key));
				const prev = current.overrides[r.key] ?? {};
				// קובץ חדש גובר על סימון הסרה — מי שגם סימן וגם העלה התכוון להחליף
				const image = uploadedByIndex.get(i) ?? (r.removeImage ? '' : (prev.image ?? ''));
				const fit = sanitizeCategoryFit(r.imageFit);
				/** @type {import('$lib/categories.js').CategoryOverride} */
				const o = {};
				if (r.name !== def.label) o.name = r.name;
				if (r.icon && r.icon !== def.icon) o.icon = r.icon;
				if (image) o.image = image;
				if (image && !isDefaultCategoryFit(fit)) o.imageFit = fit;
				if (Object.keys(o).length) next.overrides[r.key] = o;
				next.order.push(r.key);
				return;
			}

			// קטגוריה שנוספה מהמסך — חדשה או קיימת
			const prev = extrasByKey.get(r.key);
			const key = prev ? prev.key : 'x_' + randomBytes(5).toString('hex');
			const image = uploadedByIndex.get(i) ?? (r.removeImage ? '' : (prev?.image ?? ''));
			const fit = sanitizeCategoryFit(r.imageFit);
			// שינוי שם משאיר את השם הקודם כ-alias — רשומות שנשמרו איתו במאגר
			// ממשיכות להתמפות לשם החדש
			const aliases = new Set(prev?.aliases ?? []);
			if (prev && prev.name !== r.name) aliases.add(prev.name);
			aliases.delete(r.name);
			next.extras.push({
				key,
				name: r.name,
				...(r.icon ? { icon: r.icon } : {}),
				...(image ? { image } : {}),
				...(image && !isDefaultCategoryFit(fit) ? { imageFit: fit } : {}),
				aliases: [...aliases]
			});
			next.order.push(key);
		});

		// סדר אוטומטי = לא שומרים סדר בכלל; המסילה ממשיכה להסתדר לפי כמות
		if (!payload.customOrder) next.order = [];

		try {
			await saveCategorySettings(next);
		} catch (e) {
			return fail(502, {
				error: 'השמירה נכשלה: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		return { success: true, message: 'הקטגוריות נשמרו — השינויים חיים באתר' };
	},

	/** חזרה לברירות המחדל שבקוד — מוחק את כל הדריסות, הסדר והתוספות */
	reset: async ({ locals }) => {
		if (!isSuperAdmin(locals.user)) return fail(403, { error: 'פעולה זו לסופר-אדמין בלבד' });
		try {
			await saveCategorySettings({ order: [], overrides: {}, extras: [] });
		} catch (e) {
			return fail(502, {
				error: 'האיפוס נכשל: ' + (e instanceof Error ? e.message.slice(0, 140) : '')
			});
		}
		return { success: true, message: 'הקטגוריות חזרו לברירת המחדל' };
	}
};
