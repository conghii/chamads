import express from "express";
import fs from "fs";
import { spawn } from "child_process";
import dayjs from "dayjs";

const app = express();
const PORT = 3001;
let currentProcess = null;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/* API đọc cookies */
app.get("/api/get-cookies", (req, res) => {
  try {
    const data = fs.readFileSync("./cookies.json", "utf8");
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});

/* API lưu cookies */
app.post("/api/save-cookies", (req, res) => {
  try {
    const cookies = req.body;

    // Kiểm tra xem cookies có đúng dạng array không
    if (!Array.isArray(cookies)) {
      console.error("❌ Cookie gửi lên không hợp lệ:", cookies);
      return res
        .status(400)
        .json({ success: false, message: "Invalid cookie format (must be array)" });
    }

    // Ghi đè trực tiếp file cookies.json
    fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2), "utf8");
    console.log("✅ cookies.json đã được cập nhật thành công.");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Lỗi khi ghi cookies.json:", err);
    res.status(500).json({ success: false });
  }
});

/* API chạy script (Run + Continue) */
app.post("/api/run", (req, res) => {
  const {
    sheetId,
    concurrency,
    maxPages,
    flushEvery,
    batchWrite,
    date,
    mode
  } = req.body;

  // full | continue
  const runMode = mode === "continue" ? "continue" : "full";
  console.log("▶️ RUN MODE:", runMode);

  res.setHeader("Content-Type", "text/plain");

  // spawn index.js với ENV đã set MODE
  currentProcess = spawn("node", ["index.js"], {
    env: {
      ...process.env,
      MODE: runMode,
      TARGET_SHEET_ID: sheetId || process.env.TARGET_SHEET_ID,
      CONCURRENCY: concurrency || 3,
      MAX_PAGES: maxPages || 3,
      FLUSH_EVERY: flushEvery || 50,
      BATCH_WRITE: batchWrite ? "1" : "0",
      TARGET_DATE: date || ""
    }
  });

  currentProcess.stdout.on("data", (d) => res.write(d.toString()));
  currentProcess.stderr.on("data", (d) => res.write(d.toString()));
  currentProcess.on("close", () => res.end());
});

/* API dừng script */
app.get("/api/stop", (req, res) => {
  if (currentProcess) {
    currentProcess.kill("SIGINT");
    currentProcess = null;
  }
  res.json({ stopped: true });
});

app.listen(PORT, () => console.log(`🚀 UI chạy tại http://localhost:${PORT}`));
