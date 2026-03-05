import { google } from "googleapis";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

export async function getMasterRows() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.MASTER_SHEET_ID,
    range: "Sheet1!A2:G"
  });

  const rows = res.data.values || [];
  return rows
    .map((row, i) => ({
      rowIndex: i + 2,
      stt: row[0],
      asin: row[1],
      sheetId: extractSheetId(row[2]),
      niche: row[3],
      owner: row[4],
      project: row[5],
      isChecked: row[6]?.toLowerCase() === "true"
    }))
    .filter(r => r.isChecked && r.sheetId && r.asin);
}

export async function getKeywordsFromSheet(sheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Ranking!A2:A"
  });

  return res.data.values?.map(r => r[0])?.filter(Boolean) || [];
}

export async function writeResults(sheetId, values) {
  const today = dayjs().format("DD/MM");
  const headerRange = "Ranking!1:1";

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: headerRange
  });

  const headers = headerRes.data.values?.[0] || [];

  // Tìm cột trống đầu tiên từ cột H (index 7)
  let targetColIndex = 7;
  while (headers[targetColIndex]) {
    targetColIndex++;
  }

  const targetColLetter = columnToLetter(targetColIndex + 1);

  // Ghi tiêu đề ngày
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Ranking!${targetColLetter}1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[today]]
    }
  });

  // Ghi giá trị kết quả
  const rankColRange = `Ranking!${targetColLetter}2:${targetColLetter}${values.length + 1}`;
  const rankValues = values.map(r => [r]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: rankColRange,
    valueInputOption: "RAW",
    requestBody: {
      values: rankValues
    }
  });
}

// Helper: Chuyển số → chữ cái (Excel column)
function columnToLetter(column) {
  let temp = "";
  while (column > 0) {
    let remainder = (column - 1) % 26;
    temp = String.fromCharCode(65 + remainder) + temp;
    column = Math.floor((column - 1) / 26);
  }
  return temp;
}

// Helper: Lấy ID từ link Google Sheet
function extractSheetId(raw) {
  const match = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : raw;
}
