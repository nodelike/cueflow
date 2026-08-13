import { expect, test, type Page } from '@playwright/test'

const apiURL = process.env.CUEFLOW_E2E_API_URL ?? 'http://127.0.0.1:8787'

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

async function stubWaveformRoute(page: Page) {
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

test('moves between the four workspaces by click and by keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Library/ }).click()
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
  await expect(page.getByLabel('Master library')).toBeVisible()

  await page.getByRole('button', { name: /^Sources/ }).click()
  await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Spotify' })).toBeVisible()

  await page.keyboard.press('Meta+1')
  await expect(page.getByLabel('Set brief')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Set brief')).toBeVisible()
})

test('generates, compares, and field-tests persisted set variations', async ({ page, request }) => {
  await request.post(`${apiURL}/api/seed`)
  await stubWaveformRoute(page)
  await page.goto('/')
  await mockDesktopWaveform(page)

  // Must-play is a search in the brief bar; the pin lands in the playlist column.
  await page.getByRole('searchbox', { name: 'Search tracks to must-play' }).fill('a')
  const firstResult = page.getByLabel('Track search results').getByRole('button').first()
  const requiredTrack = (await firstResult.locator('strong').textContent())!
  await firstResult.click()
  await expect(page.getByLabel('Must-play tracks')).toContainText(requiredTrack)

  await page.reload()
  await mockDesktopWaveform(page)
  await expect(page.getByLabel('Must-play tracks')).toContainText(requiredTrack)

  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Afro to pressure — A' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(3)

  // The mix sheet describes every blend between the tracks it lists.
  const sheet = page.getByLabel('Set track list')
  const link = page.getByLabel(/^Field test .* into .*/).first()
  await expect(link).toBeVisible()
  await link.getByRole('button', { name: / compatible$/ }).click()
  await expect(link).toHaveClass(/verdict-compatible/)
  await expect(page.getByLabel('Track and transition inspector')).toContainText('verified works')

  await page.reload()
  await mockDesktopWaveform(page)
  await expect(page.getByLabel(/^Field test .* into .*/).first()).toHaveClass(/verdict-compatible/)

  // Selecting a track drives the deck and the inspector.
  await sheet.getByRole('button', { name: /^2\./ }).click()
  const inspector = page.getByLabel('Track and transition inspector')
  await expect(inspector).toContainText('Track 02')
  await expect(inspector).toContainText('Blend in')
  const deck = page.getByLabel(/Full waveform for/i)
  await expect(deck.getByRole('img', { name: /Full-track peak and RMS waveform/i })).toBeVisible()

  for (let index = 0; index < 3; index++) {
    await page.getByRole('tab').nth(index).click()
    await expect(sheet).toContainText(requiredTrack)
  }
})

test('keeps the desk on one screen with isolated, readable panels', async ({ page }) => {
  await stubWaveformRoute(page)
  await page.goto('/')
  await mockDesktopWaveform(page)
  await expect(page.getByLabel('Set track list')).toBeVisible()

  expect(await page.evaluate(() => ({ scrollY: window.scrollY, bodyOverflow: getComputedStyle(document.body).overflow }))).toEqual({ scrollY: 0, bodyOverflow: 'hidden' })

  const rows = page.getByLabel('Set track list').locator('.mix-rows')
  const scrollContract = await rows.evaluate((element) => {
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

  // Three panels: the rail, the playlist column, and the inspector. Nothing else.
  expect(await page.evaluate(() => {
    const main = document.querySelector('.studio-main')!
    return {
      columns: getComputedStyle(main).gridTemplateColumns.split(' ').length,
      panels: [...main.children].length,
    }
  })).toEqual({ columns: 2, panels: 2 })

  // The waveform sits above the sheet inside the playlist column, never in the inspector.
  expect(await page.getByLabel(/Full waveform for/i).evaluate((element) => {
    const column = element.closest('.studio-column')!.getBoundingClientRect()
    const deck = element.getBoundingClientRect()
    const sheet = document.querySelector('.mix-sheet')!.getBoundingClientRect()
    return {
      spansColumn: Math.abs(deck.width - column.width) < 2,
      aboveSheet: deck.bottom <= sheet.top,
      insideInspector: Boolean(element.closest('.inspector')),
    }
  })).toEqual({ spansColumn: true, aboveSheet: true, insideInspector: false })

  // Readability floor: the working type never shrinks back into microtype.
  const readability = await page.evaluate(() => {
    const size = (selector: string) => Number.parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize)
    return {
      control: size('.bar-field select'),
      trackTitle: size('.mix-row strong'),
      trackArtist: size('.mix-row small'),
      inspectorTitle: size('.inspector h2'),
      primaryAction: size('.brief-bar .generate'),
      rowHeight: document.querySelector('.mix-row')!.getBoundingClientRect().height,
    }
  })
  expect(readability.control).toBeGreaterThanOrEqual(12)
  expect(readability.trackTitle).toBeGreaterThanOrEqual(15)
  expect(readability.trackArtist).toBeGreaterThanOrEqual(12)
  expect(readability.inspectorTitle).toBeGreaterThanOrEqual(17)
  expect(readability.primaryAction).toBeGreaterThanOrEqual(12)
  expect(readability.rowHeight).toBeGreaterThanOrEqual(50)

  // Traffic lights need clear space at the top of the sidebar rail.
  expect(await page.locator('.sidebar-brand').evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop))).toBeGreaterThanOrEqual(20)
})
