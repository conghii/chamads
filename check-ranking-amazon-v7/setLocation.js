const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // mở thật để thao tác
  const page = await browser.newPage();

  await page.goto('https://www.amazon.com/', { waitUntil: 'networkidle2' });

  // Nhấn vào nút chọn địa chỉ
  await page.waitForSelector('#nav-global-location-popover-link');
  await page.click('#nav-global-location-popover-link');

  // Chờ popup hiện ra
  await page.waitForSelector('#GLUXZipUpdateInput');
  await page.type('#GLUXZipUpdateInput', '10011');
  await page.click('#GLUXZipUpdate');

  // Chờ reload lại
  await page.waitForTimeout(5000);

  // Lưu cookie & localStorage
  const cookies = await page.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));

  await browser.close();
})();