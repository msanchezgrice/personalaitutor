// Production QA walk. Usage: node walk.js <desktop|mobile> [--skip-generate]
// Records one video of the whole session, takes a numbered screenshot at every
// step, and writes <profile>/steps.json. It generates exactly ONE career map
// (the site allows 5 per hour per IP) and never submits an email, creates an
// account or starts a trial.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.QA_BASE || 'https://www.myaiskilltutor.com';
const profile = process.argv[2] === 'mobile' ? 'mobile' : 'desktop';
const skipGenerate = process.argv.includes('--skip-generate');
const ROOT = __dirname;
const OUT = path.join(ROOT, profile);
const SHOTS = path.join(OUT, 'shots');
const VIDEO = path.join(OUT, 'video-raw');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEO, { recursive: true });

const viewport = profile === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const RESUME = fs.readFileSync(path.join(ROOT, 'fixtures/resume.txt'), 'utf8');
const DESCRIBE =
  'I was a community manager at a mid-size game studio for five years. I ran our Discord and subreddit, wrote the weekly patch notes and the player newsletter, ' +
  'answered player questions about balance changes, collected feedback into a report for the designers every Friday, and handled the angry threads when a launch went badly.';

const steps = [];
let n = 0;
let page;
const consoleErrors = [];

async function shot(name, opts = {}) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: Boolean(opts.full) }).catch(() => {});
  return file;
}

async function metrics() {
  return page
    .evaluate(() => ({
      url: location.pathname + location.search,
      title: document.title,
      h1: (document.querySelector('h1') || {}).innerText || null,
      overflowPx: document.documentElement.scrollWidth - window.innerWidth,
      headerHeight: (() => {
        const h = document.querySelector('.rm-header, header');
        return h ? Math.round(h.getBoundingClientRect().height) : null;
      })(),
    }))
    .catch(() => ({}));
}

async function step(name, fn) {
  const entry = { name, ok: true, notes: [], shots: [] };
  const errorsBefore = consoleErrors.length;
  const started = Date.now();
  try {
    await fn(entry);
  } catch (error) {
    entry.ok = false;
    entry.notes.push('FAILED: ' + String(error && error.message ? error.message : error).slice(0, 300));
    entry.shots.push(await shot(name + '-FAILED'));
  }
  entry.ms = Date.now() - started;
  entry.metrics = await metrics();
  entry.newConsoleErrors = consoleErrors.slice(errorsBefore).filter((e) => !/Content Security Policy|google\.com|doubleclick|vercel\.live|selfimprove/i.test(e)).slice(0, 5);
  steps.push(entry);
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${name} (${entry.ms} ms) overflow=${entry.metrics.overflowPx} ${entry.notes.join(' | ')}`);
  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify({ base: BASE, profile, viewport, steps }, null, 2));
}

async function go(url, wait = 2500) {
  const res = await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(wait);
  return res ? res.status() : 0;
}

async function slowScroll() {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const stride = Math.round(viewport.height * 0.8);
  for (let y = 0; y < height; y += stride) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
    await page.waitForTimeout(650);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: profile === 'mobile',
    hasTouch: profile === 'mobile',
    recordVideo: { dir: VIDEO, size: viewport },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 300)));

  let mapPath = null;

  await step('home-load', async (e) => {
    const status = await go('/');
    e.notes.push('status ' + status);
    if (status !== 200) throw new Error('home status ' + status);
    e.shots.push(await shot('home-top'));
    e.shots.push(await shot('home-full', { full: true }));
    const h1 = await page.locator('h1').first().innerText();
    if (!/unmapped/i.test(h1)) throw new Error('unexpected h1: ' + h1);
  });

  await step('home-scroll-sections', async (e) => {
    await slowScroll();
    for (const id of ['landing-stats', 'landing-example', 'launch-film', 'landing-pricing', 'landing-faq']) {
      const el = page.locator(`[data-testid="${id}"]`).first();
      if ((await el.count()) === 0) { e.notes.push('missing section ' + id); e.ok = false; continue; }
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      e.shots.push(await shot('home-' + id));
    }
  });

  await step('home-film-plays', async (e) => {
    const play = page.locator('[data-testid="cta-play-film"]').first();
    await play.scrollIntoViewIfNeeded();
    await play.click();
    await page.waitForTimeout(4000);
    const state = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v ? { paused: v.paused, t: v.currentTime, ready: v.readyState, src: v.currentSrc } : null;
    });
    e.notes.push('video ' + JSON.stringify(state));
    e.shots.push(await shot('home-film-playing'));
    if (!state || state.paused || state.t < 0.5) throw new Error('film did not start playing');
    await page.evaluate(() => document.querySelector('video') && document.querySelector('video').pause());
  });

  await step('home-nav-links', async (e) => {
    await go('/', 1200);
    const links = await page.locator('.rm-nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    e.notes.push('nav: ' + links.join(', '));
    for (const href of links.filter((h) => h && h.startsWith('/#'))) {
      const id = href.slice(2);
      const exists = await page.evaluate((x) => Boolean(document.getElementById(x)), id);
      if (!exists) { e.ok = false; e.notes.push('nav target missing: #' + id); }
    }
  });

  await step('hero-to-map-generation', async (e) => {
    if (skipGenerate) { e.notes.push('skipped (--skip-generate)'); return; }
    await go('/', 1500);
    const text = profile === 'mobile' ? DESCRIBE : RESUME;
    await page.locator('#hero-background').fill(text);
    e.shots.push(await shot('hero-filled'));
    await page.locator('[data-testid="cta-map-career-hero"]').click();
    await page.waitForURL(/\/map(\?|$)/, { timeout: 20000 });
    await page.waitForTimeout(2500);
    e.shots.push(await shot('map-generating'));
    const started = Date.now();
    await page.waitForURL(/\/map\/[A-Za-z0-9_-]{8,}/, { timeout: 120000 }).catch(async () => {
      const err = await page.locator('[data-testid="career-map-error"]').first().innerText().catch(() => '');
      throw new Error('no result page after 120 s. Error box: ' + (err || 'none'));
    });
    e.notes.push('generated in ' + Math.round((Date.now() - started) / 1000) + ' s (after the first 2.5 s)');
    await page.waitForTimeout(3500);
    mapPath = new URL(page.url()).pathname;
    e.notes.push('mapPath ' + mapPath);
    e.shots.push(await shot('map-result-top'));
    e.shots.push(await shot('map-result-full', { full: true }));
  });

  await step('map-result-contents', async (e) => {
    if (!mapPath) { e.notes.push('no map generated in this run'); e.ok = skipGenerate; return; }
    await slowScroll();
    const count = await page.locator('[data-testid="career-map-translations"] .rm-translation, [data-testid="career-map-translations"] li, [data-testid="career-map-translations"] article').count();
    e.notes.push('translation nodes: ' + count);
    const text = await page.locator('[data-testid="career-map-result"]').first().innerText();
    e.notes.push('result text length ' + text.length);
    for (const id of ['career-map-fit', 'career-map-translations', 'career-map-alternate', 'career-map-disclaimer', 'career-map-email-form']) {
      if ((await page.locator(`[data-testid="${id}"]`).count()) === 0) { e.ok = false; e.notes.push('missing ' + id); }
    }
    fs.writeFileSync(path.join(OUT, 'map-result-text.txt'), text);
  });

  await step('map-result-copy-link-and-email-validation', async (e) => {
    if (!mapPath) { e.notes.push('no map generated in this run'); e.ok = skipGenerate; return; }
    await page.locator('[data-testid="career-map-copy-link"]').first().click();
    await page.waitForTimeout(800);
    e.shots.push(await shot('map-copy-link'));
    const form = page.locator('[data-testid="career-map-email-form"]').first();
    await form.scrollIntoViewIfNeeded();
    await form.locator('input[type="email"]').fill('not-an-email');
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(1200);
    e.shots.push(await shot('map-email-invalid'));
    e.notes.push('a real email was NOT submitted, on purpose');
  });

  await step('map-reload-shared-link', async (e) => {
    if (!mapPath) { e.notes.push('no map generated in this run'); e.ok = skipGenerate; return; }
    // A fresh context has no owner cookie: this is what someone you share the link with sees.
    const other = await browser.newContext({ viewport });
    const p2 = await other.newPage();
    const res = await p2.goto(BASE + mapPath, { waitUntil: 'load' });
    await p2.waitForTimeout(2500);
    n += 1;
    const file = `${String(n).padStart(2, '0')}-map-as-visitor.png`;
    await p2.screenshot({ path: path.join(SHOTS, file) });
    e.shots.push(file);
    e.notes.push('visitor status ' + (res ? res.status() : 0));
    const og = await p2.evaluate(() => (document.querySelector('meta[property="og:image"]') || {}).content || null);
    e.notes.push('og:image ' + og);
    if (og) {
      const img = await other.request.get(og.startsWith('http') ? og : BASE + og);
      e.notes.push('og image status ' + img.status() + ' type ' + img.headers()['content-type']);
      if (img.ok()) fs.writeFileSync(path.join(SHOTS, `${String(n).padStart(2, '0')}-map-og-image.png`), await img.body());
      else e.ok = false;
    }
    await other.close();
  });

  await step('map-input-modes', async (e) => {
    const status = await go('/map');
    e.notes.push('status ' + status);
    e.shots.push(await shot('map-input-top'));
    e.shots.push(await shot('map-input-full', { full: true }));
    // too-short text must be refused client-side, with no request made
    await page.locator('[data-testid="career-map-text"]').fill('I was a tester.');
    await page.locator('[data-testid="career-map-submit"]').click();
    await page.waitForTimeout(1000);
    e.shots.push(await shot('map-input-too-short'));
    const err = await page.locator('[data-testid="career-map-error"], [role="alert"]').first().innerText().catch(() => '');
    e.notes.push('too-short message: ' + (err || 'NONE SHOWN').slice(0, 160));
    if (/\/map\//.test(page.url())) throw new Error('too-short text was accepted');
  });

  await step('map-upload-extract', async (e) => {
    await go('/map?upload=1');
    e.shots.push(await shot('map-upload-mode'));
    const fixture = profile === 'mobile' ? 'fixtures/resume.docx' : 'fixtures/resume.pdf';
    await page.locator('[data-testid="career-map-file"]').setInputFiles(path.join(ROOT, fixture));
    await page.locator('[data-testid="career-map-text"]').waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForTimeout(1500);
    const value = await page.locator('[data-testid="career-map-text"]').inputValue();
    e.notes.push(`${fixture} -> ${value.length} characters extracted`);
    e.shots.push(await shot('map-upload-extracted'));
    if (!/Priya Raman/.test(value) || !/TestRail/.test(value)) throw new Error('extracted text is missing expected content: ' + value.slice(0, 120));
    e.notes.push('the extracted text was NOT submitted (one map per run)');
  });

  await step('remapped-index-and-route', async (e) => {
    const status = await go('/remapped');
    e.notes.push('index status ' + status);
    e.shots.push(await shot('remapped-index-top'));
    e.shots.push(await shot('remapped-index-full', { full: true }));
    const links = page.locator('[data-testid="remapped-route-link"]');
    e.notes.push('routes listed: ' + (await links.count()));
    await links.first().click();
    await page.waitForURL(/\/remapped\/.+/, { timeout: 20000 });
    await page.waitForTimeout(2500);
    e.shots.push(await shot('remapped-route-top'));
    e.shots.push(await shot('remapped-route-full', { full: true }));
    await slowScroll();
    const future = await page.request.get(BASE + '/remapped/copywriter-to-content-systems-editor');
    const unknown = await page.request.get(BASE + '/remapped/not-a-real-route');
    e.notes.push('unknown slug status ' + unknown.status() + '; a scheduled slug guess returned ' + future.status());
    if (unknown.status() !== 404) e.ok = false;
  });

  await step('example-proof-page', async (e) => {
    const status = await go('/u/maya-ortiz');
    e.notes.push('status ' + status);
    e.shots.push(await shot('maya-top'));
    e.shots.push(await shot('maya-full', { full: true }));
    await slowScroll();
    for (const id of ['example-profile-label', 'example-voice-model', 'example-build-log']) {
      if ((await page.locator(`[data-testid="${id}"]`).count()) === 0) { e.ok = false; e.notes.push('missing ' + id); }
    }
  });

  await step('signup-from-map', async (e) => {
    const status = await go('/sign-up?from=map', 5000);
    e.notes.push('status ' + status);
    e.shots.push(await shot('signup-from-map'));
    e.shots.push(await shot('signup-from-map-full', { full: true }));
    const clerk = await page.locator('.cl-rootBox, .cl-signUp-root, [data-clerk-component]').count();
    e.notes.push('Clerk sign-up widget nodes: ' + clerk);
    if (!clerk) { e.ok = false; e.notes.push('sign-up widget did not render'); }
    e.notes.push('no account was created, on purpose');
  });

  await step('pricing-cta-targets', async (e) => {
    await go('/', 1200);
    const trial = await page.locator('[data-testid="cta-start-trial-pricing"]').first().getAttribute('href');
    const mapCta = await page.locator('[data-testid="cta-map-career-pricing"]').first().getAttribute('href');
    e.notes.push('trial CTA -> ' + trial + ' ; free CTA -> ' + mapCta);
    if (!trial || !/sign-up/.test(trial)) e.ok = false;
  });

  await step('dashboard-signed-out', async (e) => {
    for (const p of ['/dashboard', '/dashboard/map', '/dashboard/proof', '/dashboard/proof/site']) {
      await go(p, 2500);
      const url = new URL(page.url());
      e.notes.push(`${p} -> ${url.pathname}`);
      if (!/sign-in|sign-up/.test(url.pathname)) { e.ok = false; e.notes.push('NOT redirected to sign-in: ' + p); }
    }
    e.shots.push(await shot('dashboard-signed-out'));
  });

  await step('existing-pages-still-work', async (e) => {
    for (const [name, p] of [['assessment', '/assessment/'], ['learn', '/learn'], ['employers', '/employers'], ['alex-profile', '/u/alex-chen-ai'], ['sign-in', '/sign-in']]) {
      const status = await go(p, 4000);
      const m = await metrics();
      e.notes.push(`${p} status ${status} overflow ${m.overflowPx}`);
      e.shots.push(await shot('existing-' + name));
      if (status !== 200) e.ok = false;
    }
  });

  await step('machine-files-and-apis', async (e) => {
    for (const p of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/agents.md', '/.well-known/agent-card.json', '/video/the-missing-map-poster.jpg']) {
      const res = await page.request.get(BASE + p);
      e.notes.push(`${p} ${res.status()}`);
      if (res.status() !== 200) e.ok = false;
    }
    const sitemap = await (await page.request.get(BASE + '/sitemap.xml')).text();
    e.notes.push('sitemap has /map: ' + /\/map</.test(sitemap) + ', remapped routes: ' + (sitemap.match(/\/remapped\//g) || []).length + ', maya: ' + /maya-ortiz/.test(sitemap));
    // Signed-out API calls must be refused.
    for (const p of ['/api/build-log', '/api/voice-models', '/api/proof/site']) {
      const res = await page.request.get(BASE + p, { headers: { 'x-user-id': 'spoofed-user' } });
      e.notes.push(`${p} signed out (with a spoofed x-user-id header) -> ${res.status()}`);
      if (res.status() < 400) { e.ok = false; e.notes.push('PRIVATE API ANSWERED A SIGNED-OUT REQUEST: ' + p); }
    }
    const missing = await page.request.get(BASE + '/api/career-map/this-token-does-not-exist-123');
    e.notes.push('unknown map token API -> ' + missing.status());
  });

  await step('not-found-pages', async (e) => {
    const status = await go('/this-page-does-not-exist');
    e.notes.push('unknown page status ' + status);
    e.shots.push(await shot('404-page'));
    const status2 = await go('/map/zzzzzzzzzzzzzzzzzzzzzzzz');
    e.notes.push('unknown map status ' + status2);
    e.shots.push(await shot('404-map'));
    if (status !== 404 || status2 !== 404) e.ok = false;
  });

  await context.close();
  await browser.close();
  const video = fs.readdirSync(VIDEO).filter((f) => f.endsWith('.webm'))[0];
  fs.writeFileSync(
    path.join(OUT, 'steps.json'),
    JSON.stringify({ base: BASE, profile, viewport, mapPath, rawVideo: video ? path.join(VIDEO, video) : null, consoleErrors: [...new Set(consoleErrors)].slice(0, 40), steps }, null, 2),
  );
  console.log('\nDONE', profile, 'steps', steps.length, 'failed', steps.filter((s) => !s.ok).length, 'video', video);
})();
