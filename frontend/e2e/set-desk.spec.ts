import { expect, test, type Page } from '@playwright/test'

async function mockDesktopWaveform(page: Page) {
  await page.evaluate(() => {
    if (!window.go?.main?.App) return
    window.go.main.App.TrackWaveform = async (trackId: string) => ({
      trackId,
      durationSeconds: 300,
      analyzerVersion: 'e2e/1',
      waveform: Array.from({ length: 24 }, (_, index) => ({ startSeconds: index, endSeconds: index + 1, rms: .15 + index % 5 * .04, peak: .4 + index % 7 * .06 })),
    })
  })
}

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
  await page.route(/\/api\/tracks\/[^/]+\/waveform(?:\?.*)?$/, async (route) => {
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
  await mockDesktopWaveform(page)
  await expect(page.getByRole('heading', { name: 'Build a set' })).toBeVisible()
  await page.getByRole('button', { name: 'Choose tracks' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose must-play tracks' })
  const firstTrack = picker.getByLabel('Track search results').getByRole('button').first()
  const requiredTrack = (await firstTrack.locator('strong').textContent())!
  await firstTrack.click()
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByLabel('Set brief')).toContainText(requiredTrack)
  await page.reload()
  await mockDesktopWaveform(page)
  await expect(page.getByLabel('Set brief')).toContainText(requiredTrack)
  await page.getByRole('button', { name: 'Generate set' }).click()
  await expect(page.getByText('Afro to pressure — A')).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(3)
  const fieldTest = page.getByLabel(/Field test .* into .*/)
  await fieldTest.getByRole('button', { name: 'Mark this transition compatible' }).click()
  await expect(fieldTest.getByText('Verified works')).toBeVisible()
  await expect(fieldTest.getByText(/Cueflow will favor this pairing/i)).toBeVisible()
  await page.reload()
  await mockDesktopWaveform(page)
  await expect(page.getByLabel(/Field test .* into .*/).getByRole('button', { name: 'Mark this transition compatible' })).toHaveAttribute('aria-pressed', 'true')
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
  expect(readability).toEqual({ control: 14, sectionLabel: 12, trackTitle: 16, trackArtist: 13, inspectorTitle: 22, primaryAction: 14, trackRowHeight: 64 })
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
  const waveformDeck = page.getByLabel(/Full waveform for/i)
  await expect(waveformDeck.getByRole('img', { name: /Full-track peak and RMS waveform/i })).toBeVisible()
  expect(await waveformDeck.evaluate((element) => {
    const workspace = element.closest('.set-workspace')!.getBoundingClientRect()
    const deck = element.getBoundingClientRect()
    const inspector = document.querySelector('.track-inspector')!.getBoundingClientRect()
    return {
      spansWorkspace: Math.abs(deck.left - workspace.left) < 1 && Math.abs(deck.right - workspace.right) < 1,
      aboveInspector: deck.bottom < inspector.top,
      insideInspector: Boolean(element.closest('.track-inspector')),
    }
  })).toEqual({ spansWorkspace: true, aboveInspector: true, insideInspector: false })
  for (let index = 0; index < 3; index++) {
    await page.getByRole('tab').nth(index).click()
    await expect(page.getByLabel('Set track list')).toContainText(requiredTrack)
  }
})
