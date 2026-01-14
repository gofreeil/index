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
const USERS_SHEET_NAME = 'Users';

/** @param {string} spreadsheetId */
async function ensureUsersSheetExists(spreadsheetId) {
	try {
		const meta = await sheets.spreadsheets.get({ spreadsheetId });
		const sheetExists = meta.data.sheets?.some((s) => s.properties?.title === USERS_SHEET_NAME);

		if (!sheetExists) {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId,
				requestBody: {
					requests: [
						{
							addSheet: {
								properties: { title: USERS_SHEET_NAME }
							}
						}
					]
				}
			});

			// Initialize with headers: ID, Name, Email, Password, CreatedAt
			await sheets.spreadsheets.values.update({
				spreadsheetId,
				range: `${USERS_SHEET_NAME}!A1:E1`,
				valueInputOption: 'RAW',
				requestBody: {
					values: [['ID', 'Name', 'Email', 'Password', 'CreatedAt']]
				}
			});
		}
	} catch (error) {
		console.error('Error ensuring users sheet exists:', error);
	}
}

export async function POST({ request }) {
	try {
		const { name, email, password } = await request.json();
		const spreadsheetId = clean(SPREADSHEET_ID);

		await ensureUsersSheetExists(spreadsheetId);

		// Check if user already exists
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range: `${USERS_SHEET_NAME}!C:C`
		});
		const emails = response.data.values?.map((r) => r[0]) || [];
		if (emails.includes(email)) {
			return json({ success: false, error: 'User already exists' }, { status: 400 });
		}

		const id = Date.now().toString();
		const createdAt = new Date().toISOString();

		await sheets.spreadsheets.values.append({
			spreadsheetId,
			range: `${USERS_SHEET_NAME}!A:E`,
			valueInputOption: 'RAW',
			requestBody: {
				values: [[id, name, email, password, createdAt]]
			}
		});

		return json({
			success: true,
			user: { id, name, email }
		});
	} catch (error) {
		console.error('Registration API Error:', error);
		return json({ success: false, error: 'Registration failed' }, { status: 500 });
	}
}
