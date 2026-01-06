import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import {
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    SPREADSHEET_ID
} from '$env/static/private';

const clean = (str) => {
    if (!str) return '';
    let cleaned = str.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
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
        private_key: clean(GOOGLE_PRIVATE_KEY),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_NAME = 'SiteData';

async function ensureSheetExists(spreadsheetId) {
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetExists = meta.data.sheets?.some(s => s.properties?.title === SHEET_NAME);

        if (!sheetExists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: SHEET_NAME }
                        }
                    }]
                }
            });

            // Initialize with headers
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAME}!A1:B1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [['Counter Name', 'Value'], ['Total Visits', '1000']]
                }
            });
        }
    } catch (error) {
        console.error('Error ensuring sheet exists:', error);
    }
}

export async function POST() {
    try {
        const spreadsheetId = clean(SPREADSHEET_ID);
        await ensureSheetExists(spreadsheetId);

        // Read current value
        const readRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!B2`,
        });

        let currentVal = parseInt(readRes.data.values?.[0]?.[0] || '1000');
        const newVal = currentVal + 1;

        // Write new value
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_NAME}!B2`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [[newVal.toString()]]
            }
        });

        return json({ count: newVal });
    } catch (error) {
        console.error('Counter API Error:', error);
        return json({ count: 1000, error: 'Failed to update' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const spreadsheetId = clean(SPREADSHEET_ID);
        await ensureSheetExists(spreadsheetId);

        const readRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_NAME}!B2`,
        });

        let currentVal = parseInt(readRes.data.values?.[0]?.[0] || '1000');
        return json({ count: currentVal });
    } catch (error) {
        return json({ count: 1000, error: 'Failed to read' });
    }
}
