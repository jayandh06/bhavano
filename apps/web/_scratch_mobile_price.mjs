import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.goto('https://www.bhavano.com/bengaluru/pg', { waitUntil: 'networkidle' });

const priceBtn = page.getByRole('button', { name: /^Price/ }).first();
await priceBtn.click();
await page.waitForTimeout(300);

const measurements = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Price'));
  const btnRect = btn.getBoundingClientRect();
  // dropdown is the absolute-positioned sibling inside the same relative wrapper
  const wrapper = btn.parentElement;
  const dropdown = [...wrapper.children].find(c => c !== btn);
  const dRect = dropdown ? dropdown.getBoundingClientRect() : null;
  return {
    viewportWidth: window.innerWidth,
    buttonLeft: btnRect.left,
    dropdown: dRect ? { left: dRect.left, right: dRect.right, width: dRect.width } : null,
  };
});
console.log(JSON.stringify(measurements, null, 2));

await page.screenshot({ path: '/tmp/mobile_price_dropdown.png' });
await browser.close();
