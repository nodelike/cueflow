import { expect, test } from '@playwright/test'

test('switches to dark mode, uses the acid accent, and remembers the choice', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Use dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--accent').trim())).toBe('#DEFF00')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('generates, compares, and inspects persisted set variations', async ({ page, request }) => {
  await request.post('http://127.0.0.1:8787/api/seed')
  await page.route('**/api/tracks/*/waveform', async (route) => {
    const trackId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2) ?? '')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        trackId,
        durationSeconds: 300,
        analyzerVersion: 'e2e/1',
        waveform: Array.from({ length: 24 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, rms: .15 + index % 5 * .04, peak: .4 + index % 7 * .06 })),
      }),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Build a set' })).toBeVisible()
  await page.getByRole('button', { name: 'Choose tracks' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose must-play tracks' })
  await picker.getByRole('searchbox', { name: 'Search tracks' }).fill('claydrums')
  await picker.getByRole('button', { name: /Clay Drums/ }).click()
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByLabel('Set brief')).toContainText('Clay Drums')
  await page.reload()
  await expect(page.getByLabel('Set brief')).toContainText('Clay Drums')
  await page.getByRole('button', { name: 'Generate set' }).click()
  await expect(page.getByText('Afro to pressure — A')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(3)
  expect(await page.evaluate(() => ({ scrollY: window.scrollY, bodyOverflow: getComputedStyle(document.body).overflow }))).toEqual({ scrollY: 0, bodyOverflow: 'hidden' })
  const ledgerScroll = page.getByLabel('Set track list').locator('.ledger-scroll')
  const scrollContract = await ledgerScroll.evaluate((element) => {
    const style = getComputedStyle(element)
    const initialTop = element.scrollTop
    element.scrollTop = element.scrollHeight
    return {
      isolated: element.scrollHeight > element.clientHeight && element.scrollTop > initialTop,
      overscroll: style.overscrollBehaviorY,
      scrollbar: style.scrollbarWidth,
      windowScrollY: window.scrollY,
    }
  })
  expect(scrollContract).toEqual({ isolated: true, overscroll: 'contain', scrollbar: 'none', windowScrollY: 0 })
  await expect(page.getByLabel('Track and transition inspector')).toHaveCSS('position', 'static')
  const readability = await page.evaluate(() => {
    const fontSize = (selector: string) => Number.parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize)
    return {
      control: fontSize('.control input'),
      sectionLabel: fontSize('.section-label > span'),
      trackTitle: fontSize('.ledger-scroll > button strong'),
      trackArtist: fontSize('.ledger-scroll > button small'),
      inspectorTitle: fontSize('.track-inspector h2'),
      primaryAction: fontSize('.generate-button'),
      trackRowHeight: document.querySelector('.ledger-scroll > button')!.getBoundingClientRect().height,
    }
  })
  expect(readability).toEqual({ control: 13, sectionLabel: 10, trackTitle: 12, trackArtist: 10, inspectorTitle: 20, primaryAction: 13, trackRowHeight: 52 })
  const windowChrome = await page.evaluate(() => ({
    titlebarHeight: document.querySelector('.app-header')!.getBoundingClientRect().height,
    workspaceRows: getComputedStyle(document.querySelector('.app-shell')!).gridTemplateRows,
  }))
  expect(windowChrome.titlebarHeight).toBe(44)
  expect(windowChrome.workspaceRows.startsWith('44px ')).toBe(true)
  const timeline = page.getByLabel(/mix timeline/i)
  await expect(timeline).toBeVisible()
  const tracks = timeline.getByRole('button')
  expect(await tracks.count()).toBeGreaterThanOrEqual(3)
  await timeline.getByRole('button', { name: /^2\./ }).click()
  const inspector = page.getByLabel('Track and transition inspector')
  await expect(inspector).toContainText('Track 02')
  await expect(inspector).toContainText('Transition in')
  await expect(inspector.getByRole('img', { name: /Full-track peak and RMS waveform/i })).toBeVisible()
  for (let index = 0; index < 3; index++) {
    await page.getByRole('tab').nth(index).click()
    await expect(page.getByLabel('Set track list')).toContainText('Clay Drums')
  }
})
