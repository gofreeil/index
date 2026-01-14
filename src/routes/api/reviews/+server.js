import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import { GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, SPREADSHEET_ID } from '$env/static/private';

/** @param {string} str */
const clean = (str) => {
	if (!str) return '';
	let cleaned = str
		.replace(/\\r\\n/g, '\n')
		.replace(/\\n/g, '\n')
		.replace(/\r\n/g, '\n');
	cleaned = cleaned.replace(/\\\n/g, '\n');
	cleaned = cleaned.trim();
	if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
		cleaned = cleaned.substring(1, cleaned.length - 1);
	}
	if (cleaned.includes('BEGIN')) {
		const header = '-----BEGIN PRIVATE KEY-----';
		const footer = '-----END PRIVATE KEY-----';
		let body = cleaned
			.replace(/-----BEGIN[\s\S]*?KEY-----/g, '')
			.replace(/-----END[\s\S]*?KEY-----/g, '')
			.replace(/\\/g, '')
			.replace(/\s+/g, '');
		let formattedBody = '';
		for (let i = 0; i < body.length; i += 64) {
			formattedBody += body.substring(i, i + 64) + '\n';
		}
		cleaned = `${header}\n${formattedBody}${footer}`;
	}
	return cleaned;
};

const auth = new google.auth.GoogleAuth({
	credentials: {
		client_email: clean(GOOGLE_CLIENT_EMAIL),
		private_key: clean(GOOGLE_PRIVATE_KEY)
	},
	scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const REVIEWS_SHEET_NAME = 'Reviews';

/** @param {string} spreadsheetId */
async function ensureReviewsSheetExists(spreadsheetId) {
	try {
		const meta = await sheets.spreadsheets.get({ spreadsheetId });
		const sheetExists = meta.data.sheets?.some((s) => s.properties?.title === REVIEWS_SHEET_NAME);

		if (!sheetExists) {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{
							addSheet: {
								properties: { title: REVIEWS_SHEET_NAME }
							}
						}
					]
				}
			});

			// Headers: ID, BusinessID, UserID, UserName, Rating, Comment, Date, Approved
			await sheets.spreadsheets.values.update({
				spreadsheetId,
				range: `${REVIEWS_SHEET_NAME}!A1:H1`,
				valueInputOption: 'RAW',
				requestBody: {
					values: [
						['ID', 'BusinessID', 'UserID', 'UserName', 'Rating', 'Comment', 'Date', 'Approved']
					]
				}
			});
		}
	} catch (error) {
		console.error('Error ensuring reviews sheet exists:', error);
	}
}

export async function GET({ url }) {
	try {
		const businessId = url.searchParams.get('businessId');
		const spreadsheetId = clean(SPREADSHEET_ID);

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${REVIEWS_SHEET_NAME}!A:H`
		});

		const rows = response.data.values || [];
		if (rows.length === 0) return json([]);

		const headers = rows[0];
		const reviews = rows
			.slice(1)
			.map((row) => {
				/** @type {any} */
				const review = {};
				headers.forEach((header, i) => {
					review[header.toLowerCase()] = row[i];
				});
				return review;
			})
			.filter((r) => {
				const matchBusiness = !businessId || String(r.businessid) === String(businessId);
				const isApproved = r.approved === 'TRUE' || r.approved === '1' || r.approved === 'yes';
				return matchBusiness && isApproved;
			});

		return json(reviews);
	} catch (error) {
		console.error('Reviews Fetch Error:', error);
		return json([]);
	}
}

export async function POST({ request }) {
	try {
		const { businessId, userId, userName, rating, comment } = await request.json();
		const spreadsheetId = clean(SPREADSHEET_ID);

		await ensureReviewsSheetExists(spreadsheetId);

		const id = Date.now().toString();
		const date = new Date().toISOString().split('T')[0];

		await sheets.spreadsheets.values.append({
			spreadsheetId,
			range: `${REVIEWS_SHEET_NAME}!A:H`,
			valueInputOption: 'RAW',
			requestBody: {
				values: [[id, businessId, userId, userName, rating, comment, date, 'FALSE']]
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Review Post Error:', error);
		return json({ success: false, error: 'Failed to post review' }, { status: 500 });
	}
}
