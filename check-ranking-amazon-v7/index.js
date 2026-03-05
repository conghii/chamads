// main_fast_cookie_persistent.js
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import { google } from "googleapis";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

dotenv.config();

/* ============== Google Sheets ============== */
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});
const sheets = google.sheets({ version: "v4", auth });

/* ============== Utils ============== */
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const MAX_PAGES = Number(process.env.MAX_PAGES || 3);
// BATCH_WRITE và FLUSH_EVERY vẫn giữ cho tương thích, nhưng trong bản này
// chủ yếu ghi theo nhóm (full) hoặc theo từng ô (continue)
const BATCH_WRITE = process.env.BATCH_WRITE === "1";
const FLUSH_EVERY = Number(process.env.FLUSH_EVERY || 50);
const MODE = process.env.MODE || "full";   // "full" | "continue"

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ============== Sheets helpers ============== */
// Lấy danh sách nhóm keyword theo cấu trúc: blank line ngắt nhóm, cột E = ASIN, F = keyword
async function getKeywordGroups(spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!E2:F`
  });
  const rows = res.data.values || [];

  const groups = [];
  let currentAsin = null;
  let buffer = [];

  for (let i = 0; i < rows.length; i++) {
    const asin = (rows[i][0] || "").trim();
    const keyword = (rows[i][1] || "").trim();

    // Dòng trống => kết thúc nhóm
    if (!asin && !keyword) {
      if (currentAsin && buffer.length > 0) {
        groups.push({ asin: currentAsin, keywords: buffer.slice() });
      }
      currentAsin = null;
      buffer = [];
      continue;
    }

    // Dòng mở đầu nhóm mới: có cả asin + keyword
    if (asin && keyword) {
      if (currentAsin && buffer.length > 0) {
        groups.push({ asin: currentAsin, keywords: buffer.slice() });
      }
      currentAsin = asin;
      buffer = [keyword];
      continue;
    }

    // Dòng tiếp theo trong nhóm: không có asin, chỉ có keyword
    if (!asin && keyword && currentAsin) {
      buffer.push(keyword);
    }
  }

  if (currentAsin && buffer.length > 0) {
    groups.push({ asin: currentAsin, keywords: buffer.slice() });
  }

  return groups;
}

// Tìm cột header trống đầu tiên (dùng cho chế độ full để tạo cột ngày mới)
async function findFirstEmptyHeaderColumn(spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!1:1`
  });
  const header = res.data.values?.[0] || [];
  let idx = header.findIndex(v => !v || String(v).trim() === "");
  if (idx === -1) idx = header.length;
  return idx + 1; // 1-based
}

// Tìm cột ngày gần nhất (cột header có giá trị cuối cùng bên phải)
async function getLatestDateColumn(spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!1:1`
  });
  const header = res.data.values?.[0] || [];

  // tìm index đầu tiên trống
  let idxEmpty = header.findIndex(v => !v || String(v).trim() === "");
  if (idxEmpty === -1) idxEmpty = header.length;

  const lastIdx = idxEmpty - 1; // index (0-based) của ô có header cuối cùng
  if (lastIdx < 1) return null; // không có cột ngày nào ngoài cột A (hoặc chỉ 0 cột)

  const colIndex = lastIdx + 1; // 1-based
  const colLetter = colToLetter(colIndex);
  const title = header[lastIdx];

  return { colIndex, colLetter, title };
}

async function findDateColumn(spreadsheetId, title) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!1:1`
  });
  const header = res.data.values?.[0] || [];
  const idx = header.indexOf(title);
  if (idx === -1) return null;
  const colIndex = idx + 1;
  return { colIndex, colLetter: colToLetter(colIndex), title };
}

function colToLetter(col) {
  let s = "", n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function writeHeader(spreadsheetId, colLetter, title) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Rank Organic'!${colLetter}1`,
      valueInputOption: "RAW",
      requestBody: { values: [[title]] }
    });
  } catch (err) {
    if (err.message && err.message.includes("exceeds grid limits")) {
      console.log(`⚠️ Vượt quá giới hạn cột (exceeds grid limits). Đang tự động thêm cột mới...`);
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = meta.data.sheets.find(s => s.properties.title === "Rank Organic");
      if (sheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              appendDimension: {
                sheetId: sheet.properties.sheetId,
                dimension: "COLUMNS",
                length: 5
              }
            }]
          }
        });
        console.log(`✅ Đã thêm 5 cột mới. Ghi lại header...`);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Rank Organic'!${colLetter}1`,
          valueInputOption: "RAW",
          requestBody: { values: [[title]] }
        });
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }
}

async function writeRange(spreadsheetId, colLetter, startRow, values) {
  const endRow = startRow + values.length - 1;
  if (values.length === 0) return;

  // values is an array of objects: { organic, sponsored, topCompetitors, badge }
  const organicValues = values.map(v => v === "ERR" ? ["ERR"] : [v.organic]);
  const sponsoredValues = values.map(v => v === "ERR" ? ["ERR"] : [v.sponsored]);
  const competitorValues = values.map(v => v === "ERR" ? ["ERR"] : [v.topCompetitors]);
  const badgeValues = values.map(v => v === "ERR" ? ["ERR"] : [v.badge]);

  // Batch update to write Organic, Sponsored, Top Competitors and Badges ranks
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: `'Rank Organic'!${colLetter}${startRow}:${colLetter}${endRow}`,
          values: organicValues
        },
        {
          range: `'Rank Organic'!A${startRow}:A${endRow}`,
          values: badgeValues
        },
        {
          range: `'Rank Organic'!C${startRow}:C${endRow}`,
          values: sponsoredValues
        },
        {
          range: `'Rank Organic'!D${startRow}:D${endRow}`,
          values: competitorValues
        }
      ]
    }
  });
}

// Ghi một ô đơn lẻ – dùng trong chế độ "continue"
async function writeCell(spreadsheetId, colLetter, rowIndex, value) {
  const organicVal = value === "ERR" ? "ERR" : value.organic;
  const sponsoredVal = value === "ERR" ? "ERR" : value.sponsored;
  const competitorVal = value === "ERR" ? "ERR" : value.topCompetitors;
  const badgeVal = value === "ERR" ? "ERR" : value.badge;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: `'Rank Organic'!${colLetter}${rowIndex}`,
          values: [[organicVal]]
        },
        {
          range: `'Rank Organic'!A${rowIndex}`,
          values: [[badgeVal]]
        },
        {
          range: `'Rank Organic'!C${rowIndex}`,
          values: [[sponsoredVal]]
        },
        {
          range: `'Rank Organic'!D${rowIndex}`,
          values: [[competitorVal]]
        }
      ]
    }
  });
}

// Lấy danh sách các hàng còn trống trong cột ngày gần nhất
// Trả về: { pending: [{ rowIndex, asin, keyword }], latest: { colLetter, colIndex, title } }
async function getPendingRows(spreadsheetId) {
  const latest = await getLatestDateColumn(spreadsheetId);
  if (!latest) return { pending: [], latest: null };

  const { colLetter } = latest;

  // dữ liệu ASIN/Keyword
  const kvRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!E2:F`
  });
  const kvRows = kvRes.data.values || [];

  // dữ liệu cột kết quả ngày gần nhất
  const outRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'Rank Organic'!${colLetter}2:${colLetter}`
  });
  const outRows = outRes.data.values || [];

  const pending = [];
  let currentAsin = null;

  for (let i = 0; i < kvRows.length; i++) {
    const asin = (kvRows[i]?.[0] || "").trim();
    const kw = (kvRows[i]?.[1] || "").trim();
    const outCell = (outRows[i]?.[0] || "").trim(); // i=0 => row 2

    // Dòng trống => reset nhóm
    if (!asin && !kw) {
      currentAsin = null;
      continue;
    }

    // Dòng mới có asin => mở nhóm mới
    if (asin) currentAsin = asin;

    // Bỏ qua nếu chưa có asin hoặc không có keyword
    if (!currentAsin || !kw) continue;

    // Nếu ô kết quả đang trống => thêm vào danh sách cần chạy bù
    if (!outCell) {
      pending.push({
        rowIndex: 2 + i,
        asin: currentAsin,
        keyword: kw
      });
    }
  }

  return { pending, latest };
}

/* ============== Amazon helpers ============== */
async function setupPage(page) {
  await page.setRequestInterception(true);
  page.on("request", req => {
    const t = req.resourceType();
    if (t === "image" || t === "media" || t === "font") req.abort();
    else req.continue();
  });

  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  try { await page.emulateTimezone("America/New_York"); } catch { }
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
}

async function loadCookiesOnce(browser) {
  const cookiePath = path.resolve("./cookies.json");
  if (!fs.existsSync(cookiePath)) {
    console.error("🚨 Không tìm thấy cookies.json");
    process.exit(1);
  }

  const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
  const page = await browser.newPage();
  await setupPage(page);
  await page.setCookie(...cookies);
  console.log("🍪 Cookies loaded (persistent for all pages).");
  return page;
}

async function verifySession(page) {
  try {
    await page.goto("https://www.amazon.com/s?k=gift", {
      waitUntil: "domcontentloaded",
      timeout: 25000
    });
    await page.waitForSelector('div[data-component-type="s-search-result"]', {
      timeout: 8000
    });
    const body = await page.evaluate(() => document.body.innerText.toLowerCase());
    const blocked =
      body.includes("enter the characters you see below") ||
      body.includes("robot") ||
      body.includes("sorry") ||
      body.includes("503 service unavailable");
    return !blocked;
  } catch {
    return false;
  }
}

async function findRankOnPage(page, asin) {
  return await page.evaluate((asinArg) => {
    const nodes = document.querySelectorAll('div[data-component-type="s-search-result"]');
    let organicPos = 0;
    let sponsoredPos = 0;

    let result = {
      organic: 0,
      sponsored: 0,
      badge: null,
      topCompetitors: []
    };

    for (const node of nodes) {
      const a = node.getAttribute("data-asin");
      if (!a) continue;

      const hasPrice = node.querySelector(".a-price") !== null;
      const isVideo = node.innerHTML.includes("video-block")
        || node.innerText.toLowerCase().includes("video");
      const isSponsored = node.innerText.toLowerCase().includes("sponsored");

      if (hasPrice && !isVideo) {
        if (isSponsored) {
          sponsoredPos++;
          if (a === asinArg && result.sponsored === 0) result.sponsored = sponsoredPos;
        } else {
          organicPos++;

          // Store the first 3 competitor ASINs (organic)
          if (result.topCompetitors.length < 3) {
            result.topCompetitors.push(a);
          }

          if (a === asinArg && result.organic === 0) {
            result.organic = organicPos;
            // Check for badges
            const lowerText = node.innerText.toLowerCase();
            if (lowerText.includes("best seller")) {
              result.badge = "Best Seller";
            } else if (lowerText.includes("amazon's choice")) {
              result.badge = "Amazon's Choice";
            }
          }
        }
      }

      // Stop early if we found both bounds and have top 3
      if (result.organic > 0 && result.sponsored > 0 && result.topCompetitors.length === 3) break;
    }
    return result;
  }, asin);
}

async function checkKeywordRank(page, keyword, asin) {
  let finalOrganic = "Not In Top 150";
  let finalSponsored = "-";
  let finalTopCompetitors = "";
  let finalBadge = "";

  let foundOrganic = false;
  let foundSponsored = false;

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&page=${pageNum}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    try {
      await page.waitForSelector('div[data-component-type="s-search-result"]', { timeout: 8000 });
    } catch { }

    const ranks = await findRankOnPage(page, asin);

    // We only take Top 3 Competitors from Page 1
    if (pageNum === 1 && ranks.topCompetitors && ranks.topCompetitors.length > 0) {
      finalTopCompetitors = ranks.topCompetitors.join(", ");
    }

    if (ranks.organic > 0 && !foundOrganic) {
      finalOrganic = `Page ${pageNum} No ${ranks.organic}`;
      if (ranks.badge) {
        finalBadge = ranks.badge;
      }
      foundOrganic = true;
    }
    if (ranks.sponsored > 0 && !foundSponsored) {
      finalSponsored = ranks.sponsored.toString();  // Trả về số thứ tự ads
      foundSponsored = true;
    }

    // Nếu cả 2 đều tìm thấy thì dừng, còn ko thì qua trang tiếp theo
    if (foundOrganic && foundSponsored) break;
    await sleep(200 + Math.floor(Math.random() * 250));
  }
  return { organic: finalOrganic, sponsored: finalSponsored, topCompetitors: finalTopCompetitors, badge: finalBadge };
}

/* ============== MAIN ============== */
function killZombieChrome() {
  try {
    if (process.platform === "win32") {
      // Very risky to taskkill all chrome on windows, maybe ignore or narrow down
      // execSync('taskkill /F /IM chrome.exe /FI "MODULES eq chrome.dll" /FI "WINDOWTITLE eq "*puppeteer_profile*"', { stdio: 'ignore' });
    } else {
      console.log("🔪 Đang dọn dẹp các tiến trình Chrome cũ...");
      execSync('pkill -f "puppeteer_profile"', { stdio: "ignore" });
    }
    console.log("✅ Dọn dẹp Chrome hoàn tất.");
  } catch (e) {
    // pkill might exit with code 1 if no process found, ignore
  }
}

async function main() {
  const spreadsheetId = process.env.TARGET_SHEET_ID;

  killZombieChrome();

  const lockPath = path.resolve("./puppeteer_profile/SingletonLock");
  try {
    fs.rmSync(lockPath, { force: true });
    console.log("🧹 Đã dọn dẹp SingletonLock (nếu có).");
  } catch (e) {
    console.warn("⚠️ Lỗi khi thử xóa SingletonLock:", e.message);
  }

  // 1. Khởi tạo browser
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: "./puppeteer_profile",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  // 2. Nạp cookie
  const cookiePage = await loadCookiesOnce(browser);
  const cookieOK = await verifySession(cookiePage);
  if (!cookieOK) {
    console.error("🚨 Cookie lỗi hoặc hết hạn. Hãy đăng nhập lại và xuất cookies.json mới.");
    await browser.close();
    process.exit(1);
  }
  console.log("✅ Cookie hợp lệ, bắt đầu chạy...");

  // 3. Chuẩn bị context
  const context = cookiePage.browserContext();

  /* ---------- MODE: CONTINUE ---------- */
  if (MODE === "continue") {
    console.log("▶️ Chế độ: CONTINUE – chạy bù những ô trống ở cột ngày gần nhất.");

    const { pending, latest } = await getPendingRows(spreadsheetId);
    if (!latest) {
      console.log("⚠️ Không tìm thấy cột ngày nào để continue.");
      await cookiePage.close();
      await browser.close();
      return;
    }

    const { colLetter, title } = latest;
    console.log(`🗓 Cột ngày hiện tại: ${title} (${colLetter})`);
    console.log(`📄 Số hàng còn trống cần chạy bù: ${pending.length}`);

    if (!pending.length) {
      console.log("✅ Không có ô trống nào, không cần continue.");
      await cookiePage.close();
      await browser.close();
      return;
    }

    const workers = Math.min(CONCURRENCY, pending.length);
    const pages = await Promise.all(
      Array.from({ length: workers }, async () => {
        const p = await context.newPage();
        await setupPage(p);
        return p;
      })
    );

    let cursor = 0;
    const tasks = pages.map(async (p) => {
      while (true) {
        const myIndex = cursor++;
        if (myIndex >= pending.length) break;

        const item = pending[myIndex];
        const { rowIndex, asin, keyword } = item;
        try {
          const rank = await checkKeywordRank(p, keyword, asin);
          await writeCell(spreadsheetId, colLetter, rowIndex, rank);
          console.log(
            `🔁 [${myIndex + 1}/${pending.length}] ${keyword} [${asin}] → ${rank} @ ${colLetter}${rowIndex}`
          );
        } catch (e) {
          console.warn(`⚠️ Lỗi "${keyword}": ${e.message}`);
          await writeCell(spreadsheetId, colLetter, rowIndex, "ERR");
        }
      }
    });

    await Promise.all(tasks);
    await Promise.all(pages.map(p => p.close()));
    await cookiePage.close();
    await browser.close();
    console.log("\n✅ CONTINUE hoàn tất.");
    return;
  }

  /* ---------- MODE: FULL (RUN BÌNH THƯỜNG) ---------- */
  console.log("▶️ Chế độ: FULL – tạo cột ngày mới và chạy toàn bộ nhóm keyword.");

  // 4. Đọc danh sách nhóm keyword/ASIN
  const groups = await getKeywordGroups(spreadsheetId);
  if (!groups.length) {
    console.warn("⚠️ Không có nhóm keyword/ASIN hợp lệ (E & F).");
    await cookiePage.close();
    await browser.close();
    return;
  }

  // 5. Xác định cột để ghi kết quả
  const todayTitle = dayjs().format("DD/MM");
  let colLetter = "";

  const existingCol = await findDateColumn(spreadsheetId, todayTitle);
  if (existingCol) {
    console.log(`♻️ Cột ngày ${todayTitle} đã tồn tại tại ${existingCol.colLetter}. Sẽ ghi đè.`);
    colLetter = existingCol.colLetter;
  } else {
    const colIndex = await findFirstEmptyHeaderColumn(spreadsheetId);
    colLetter = colToLetter(colIndex);
    console.log(`🆕 Tạo cột ngày mới: ${todayTitle} tại ${colLetter}`);
    await writeHeader(spreadsheetId, colLetter, todayTitle);
  }

  let currentRow = 2; // bắt đầu ghi từ hàng 2

  // 6. Lặp qua từng nhóm keyword
  for (const group of groups) {
    const { asin, keywords } = group;
    console.log(`📦 Đang xử lý ASIN: ${asin} (${keywords.length} keyword)`);

    const results = new Array(keywords.length).fill("ERR");

    const workers = Math.min(CONCURRENCY, keywords.length);
    const pages = await Promise.all(
      Array.from({ length: workers }, async () => {
        const p = await context.newPage();
        await setupPage(p);
        return p;
      })
    );

    let cursor = 0;
    const tasks = pages.map(async (p) => {
      while (true) {
        const myIndex = cursor++;
        if (myIndex >= keywords.length) break;
        const kw = keywords[myIndex];
        try {
          const rank = await checkKeywordRank(p, kw, asin);
          results[myIndex] = rank;
          console.log(`🔍 ${kw} [${asin}] → ${rank}`);
        } catch (e) {
          console.warn(`⚠️ Lỗi "${kw}": ${e.message}`);
          results[myIndex] = "ERR";
        }
      }
    });

    await Promise.all(tasks);
    await Promise.all(pages.map(p => p.close()));

    await writeRange(spreadsheetId, colLetter, currentRow, results);

    // +1 dòng trống giữa các cụm
    currentRow += results.length + 1;
  }

  await cookiePage.close();
  await browser.close();
  console.log("\n✅ FULL run: hoàn tất toàn bộ cụm keyword.");
}

main().catch(console.error);
