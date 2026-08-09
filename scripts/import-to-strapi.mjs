// ============================================================
// import-to-strapi.mjs — ייבוא חד-פעמי של העסקים ל-idx-business ב-Strapi.
//
// מקור ברירת-המחדל: ה-endpoint החי https://index.gofreeil.com/api/businesses
// (עדיין מבוסס-גיליון עד לפריסת הענף) — מחזיר את העסקים המאושרים בצורת-הגיליון,
// בלי צורך ב-Google creds. ⚠️ להריץ *לפני* פריסת ענף המעבר.
//
// הרצה (Node 20+):
//   node --env-file=.env scripts/import-to-strapi.mjs              # ריצת-אמת
//   node --env-file=.env scripts/import-to-strapi.mjs --dry        # בדיקה בלי כתיבה
//   node --env-file=.env scripts/import-to-strapi.mjs --no-geo     # בלי גיאוקודינג (מהיר)
//
// דורש ב-.env: STRAPI_TOKEN (Full Access). אופציונלי: STRAPI_URL, SOURCE_URL.
// ============================================================
const DRY = process.argv.includes('--dry');
const NO_GEO = process.argv.includes('--no-geo');
const STRAPI = (process.env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const SOURCE_URL = process.env.SOURCE_URL || 'https://index.gofreeil.com/api/businesses';
const TOKEN = process.env.STRAPI_TOKEN;

if (!TOKEN) throw new Error('חסר STRAPI_TOKEN ב-env');

/** @param {Record<string,any>} row @param {string} needle */
const col = (row, needle) => {
	for (const k of Object.keys(row)) if (k.includes(needle)) return String(row[k] ?? '').trim();
	return '';
};

// שדות מסוג string ב-Strapi הם varchar(255) — חיתוך למניעת 500 (שדות text ללא הגבלה).
/** @param {string} v @param {number} [max] */
const s = (v, max = 255) => String(v ?? '').slice(0, max);

/** @param {string} url */
function driveDirect(url) {
	if (!url) return '';
	const u = url.trim();
	if (u.includes('drive.google.com') || u.includes('googledrive.com')) {
		for (const p of [/\/file\/d\/([\w-]+)/, /id=([\w-]+)/, /\/d\/([\w-]+)/]) {
			const m = u.match(p);
			if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
		}
	}
	return u;
}

/** @param {string} name @param {string} phone */
function externalId(name, phone) {
	const s = `${name}|${phone}`
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
	return `index-${s}`.slice(0, 80);
}

const geoCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} q */
async function geocode(q) {
	if (!q || NO_GEO) return { lat: null, lng: null };
	if (geoCache.has(q)) return geoCache.get(q);
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(q)}`;
		const res = await fetch(url, { headers: { 'User-Agent': 'gofreeil-index-import/1.0' } });
		await sleep(1100); // rate-limit של OSM
		if (res.ok) {
			const arr = await res.json();
			if (arr[0]) {
				const out = { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
				geoCache.set(q, out);
				return out;
			}
		}
	} catch {
		/* best-effort */
	}
	const miss = { lat: null, lng: null };
	geoCache.set(q, miss);
	return miss;
}

/** @param {string} path @param {any} [init] */
async function strapi(path, init = {}) {
	const res = await fetch(`${STRAPI}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${TOKEN}`,
			...(init.headers || {})
		}
	});
	if (!res.ok)
		throw new Error(`strapi ${path} → ${res.status} ${await res.text().catch(() => '')}`);
	return res.json();
}

async function main() {
	console.log(`מקור: ${SOURCE_URL}`);
	const res = await fetch(SOURCE_URL);
	if (!res.ok) throw new Error(`מקור → ${res.status}`);
	const rows = await res.json();
	if (!Array.isArray(rows)) throw new Error('תשובת מקור לא צפויה (לא מערך)');
	console.log(`התקבלו ${rows.length} עסקים.\n`);

	let created = 0,
		updated = 0,
		skipped = 0,
		failed = 0;

	for (const row of rows) {
		try {
			const name = col(row, 'שם העסק') || String(row.name || '').trim();
			const phone = col(row, 'טלפון');
			const discount = col(row, 'ההנחה הבלעדית');
			if (!name) {
				skipped++;
				continue;
			}
			const terms = col(row, 'אני מקבל על עצמי את תנאי הקהילה');
			const address = col(row, 'מיקום המפעל');
			const salesArea = col(row, 'אזור מכירה');

			let lat = null,
				lng = null;
			if (address) ({ lat, lng } = await geocode(address));

			const bannersRaw = col(row, 'הוסף תמונה לבאנר');
			const banners_urls = bannersRaw
				? bannersRaw
						.split(',')
						.map((s) => driveDirect(s.trim()))
						.filter(Boolean)
						.join(',')
				: '';

			const payload = {
				name: s(name),
				phone: s(phone, 60),
				discount: discount || '—',
				description: col(row, 'תיאור העסק') || col(row, 'הערות'),
				unique_content: col(row, 'תוכן ייחודי'),
				category: s(col(row, 'קטגוריה'), 120),
				contact_name: s(col(row, 'שם איש קשר')),
				address: s(address),
				sales_area: s(salesArea),
				whatsapp: s(col(row, 'קישור לווצאפ')),
				facebook: s(col(row, 'קישור לדף הפייסבוק')),
				website: s(col(row, 'קישור לאתר') || col(row, 'אתר')),
				instagram: s(col(row, 'קישור לאינסטגרם')),
				logo_url: driveDirect(row.logoFromColumnJ || col(row, 'לוגו')),
				banners_urls,
				accepted_terms: !!terms || !!discount,
				external_id: externalId(name, phone),
				source: 'sheet-import',
				// המקור כבר החזיר רק מאושרים (סינון עמודת "אושר" ב-endpoint) → מייבאים כמאושרים
				status: 'approved',
				lat,
				lng
			};

			if (DRY) {
				console.log(`[dry] ${name} ${lat ? '📍' : '  '} (${payload.category || '—'})`);
				continue;
			}

			const found = await strapi(
				`/api/idx-businesses?filters[external_id][$eq]=${encodeURIComponent(payload.external_id)}&pagination[pageSize]=1`
			);
			const existing = found?.data?.[0];
			if (existing) {
				await strapi(`/api/idx-businesses/${existing.documentId}`, {
					method: 'PUT',
					body: JSON.stringify({ data: payload })
				});
				updated++;
				console.log(`~ עודכן: ${name}`);
			} else {
				await strapi('/api/idx-businesses', {
					method: 'POST',
					body: JSON.stringify({ data: payload })
				});
				created++;
				console.log(`+ נוצר: ${name} ${lat ? '📍' : ''}`);
			}
		} catch (e) {
			failed++;
			console.log(
				`✗ נכשל: ${String(row?.['שם העסק'] || row?.name || '').slice(0, 40)} — ${e instanceof Error ? e.message.slice(0, 120) : e}`
			);
		}
	}

	console.log(
		`\nסיכום: נוצרו ${created}, עודכנו ${updated}, דולגו ${skipped}, נכשלו ${failed}${DRY ? ' (dry-run)' : ''}.`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
