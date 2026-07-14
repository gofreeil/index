// ============================================================
// import-to-strapi.mjs — ייבוא חד-פעמי של העסקים מ-Google Sheet ל-idx-business ב-Strapi.
//
// הרצה (Node 20+):
//   node --env-file=.env scripts/import-to-strapi.mjs            # ריצת-אמת
//   node --env-file=.env scripts/import-to-strapi.mjs --dry      # בדיקה בלי כתיבה
//
// דורש ב-.env: STRAPI_TOKEN (Full Access), SPREADSHEET_ID,
//              GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY. אופציונלי: STRAPI_URL.
//
// - ממפה כל שורה לפי כותרות עבריות (התאמת תת-מחרוזת, כמו ה-importer של community).
// - external_id יציב = slug של "name|phone" (תואם ל-stableId של community).
// - upsert לפי external_id → הרצה חוזרת מעדכנת, לא מכפילה.
// - גיאוקודינג best-effort דרך Nominatim (OSM, ללא מפתח); עסק בלי מיקום → אין lat/lng.
// - status: 'approved' אם עמודת "אושר" מסמנת כן, אחרת 'pending'.
// ============================================================
import { google } from 'googleapis';

const DRY = process.argv.includes('--dry');
const STRAPI = (process.env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN;
const SPREADSHEET_ID = clean(process.env.SPREADSHEET_ID || '');

if (!TOKEN) throw new Error('חסר STRAPI_TOKEN ב-env');
if (!SPREADSHEET_ID) throw new Error('חסר SPREADSHEET_ID ב-env');

/** ניקוי ערכי env (מפתח פרטי רב-שורתי, מרכאות עוטפות). @param {string} str */
function clean(str) {
	if (!str) return '';
	let c = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
	c = c.replace(/\\\n/g, '\n').trim();
	if (c.startsWith('"') && c.endsWith('"')) c = c.slice(1, -1);
	if (c.includes('BEGIN')) {
		const body = c
			.replace(/-----BEGIN[\s\S]*?KEY-----/g, '')
			.replace(/-----END[\s\S]*?KEY-----/g, '')
			.replace(/\\/g, '')
			.replace(/\s+/g, '');
		let f = '';
		for (let i = 0; i < body.length; i += 64) f += body.slice(i, i + 64) + '\n';
		c = `-----BEGIN PRIVATE KEY-----\n${f}-----END PRIVATE KEY-----`;
	}
	return c;
}

const auth = new google.auth.GoogleAuth({
	credentials: {
		client_email: clean(process.env.GOOGLE_CLIENT_EMAIL || ''),
		private_key: clean(process.env.GOOGLE_PRIVATE_KEY || '')
	},
	scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

/** @param {Record<string,any>} row @param {string} needle */
const col = (row, needle) => {
	for (const k of Object.keys(row)) if (k.includes(needle)) return String(row[k] ?? '').trim();
	return '';
};

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

const geocodeCache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} q */
async function geocode(q) {
	if (!q) return { lat: null, lng: null };
	if (geocodeCache.has(q)) return geocodeCache.get(q);
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(q)}`;
		const res = await fetch(url, { headers: { 'User-Agent': 'gofreeil-index-import/1.0' } });
		await sleep(1100); // כיבוד rate-limit של OSM (1 בקשה/שנייה)
		if (res.ok) {
			const arr = await res.json();
			if (arr[0]) {
				const out = { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
				geocodeCache.set(q, out);
				return out;
			}
		}
	} catch {
		/* best-effort */
	}
	const miss = { lat: null, lng: null };
	geocodeCache.set(q, miss);
	return miss;
}

/** @param {string} path @param {object} [init] */
async function strapi(path, init = {}) {
	const res = await fetch(`${STRAPI}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${TOKEN}`,
			...(init.headers || {})
		}
	});
	if (!res.ok) throw new Error(`strapi ${path} → ${res.status} ${await res.text().catch(() => '')}`);
	return res.json();
}

async function main() {
	// שם הגיליון הראשון
	const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
	const sheetName = meta.data.sheets?.[0]?.properties?.title;
	const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
	const rows = resp.data.values || [];
	if (rows.length < 2) {
		console.log('אין שורות בגיליון.');
		return;
	}
	const headers = rows[0];
	const records = rows.slice(1).map((r) => {
		/** @type {Record<string,any>} */
		const o = {};
		headers.forEach((h, i) => (o[h] = r[i] || ''));
		o.__logoJ = r[9] || ''; // עמודה J
		return o;
	});

	let created = 0,
		updated = 0,
		skipped = 0;

	for (const row of records) {
		const name = col(row, 'שם העסק');
		const phone = col(row, 'טלפון');
		const discount = col(row, 'ההנחה הבלעדית');
		const terms = col(row, 'אני מקבל על עצמי את תנאי הקהילה');
		if (!name || !discount) {
			skipped++;
			continue;
		}
		const approvedCell = col(row, 'אושר');
		const address = col(row, 'מיקום המפעל');
		const salesArea = col(row, 'אזור מכירה');

		let lat = null,
			lng = null;
		if (address) ({ lat, lng } = await geocode(address));

		const bannersRaw = col(row, 'הוסף תמונה לבאנר');
		const banners_urls = bannersRaw
			? bannersRaw.split(',').map((s) => driveDirect(s.trim())).filter(Boolean).join(',')
			: '';

		const payload = {
			name,
			phone,
			discount,
			description: col(row, 'תיאור העסק') || col(row, 'הערות'),
			unique_content: col(row, 'תוכן ייחודי'),
			category: col(row, 'קטגוריה'),
			contact_name: col(row, 'שם איש קשר'),
			address,
			sales_area: salesArea,
			whatsapp: col(row, 'קישור לווצאפ'),
			facebook: col(row, 'קישור לדף הפייסבוק'),
			website: col(row, 'קישור לאתר') || col(row, 'אתר'),
			instagram: col(row, 'קישור לאינסטגרם'),
			logo_url: driveDirect(row.__logoJ || col(row, 'לוגו')),
			banners_urls,
			accepted_terms: !!terms,
			external_id: externalId(name, phone),
			source: 'sheet-import',
			status: /כן|yes|1|true|✓/i.test(approvedCell) ? 'approved' : 'pending',
			lat,
			lng
		};

		if (DRY) {
			console.log(`[dry] ${payload.status.padEnd(8)} ${name} ${lat ? '📍' : '  '} (${payload.category})`);
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
			await strapi('/api/idx-businesses', { method: 'POST', body: JSON.stringify({ data: payload }) });
			created++;
			console.log(`+ נוצר: ${name} ${lat ? '📍' : ''}`);
		}
	}

	console.log(`\nסיכום: נוצרו ${created}, עודכנו ${updated}, דולגו ${skipped}${DRY ? ' (dry-run)' : ''}.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
