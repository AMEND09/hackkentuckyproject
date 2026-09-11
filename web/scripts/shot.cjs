const puppeteer = require("puppeteer-core");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:5173";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });

  // Click the "District admin" quick-demo button
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "District admin"),
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "District admin");
    if (b) b.click();
  });

  await page.waitForFunction(() => location.pathname.startsWith("/app"), { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: "/tmp/dart_dashboard.png" });

  // Also grab the Fleet table view for the table styling
  await page.goto(`${BASE}/app/fleet`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: "/tmp/dart_fleet.png" });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
