import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'

const databaseURL = process.env.DATABASE_URL ?? `postgres://${process.env.USER}@127.0.0.1:5432/cueflow?sslmode=disable`
const trackID = 'e2e-review-track'

test.beforeAll(() => {
  execFileSync('psql', [databaseURL, '-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO tracks (id,spotify_id,spotify_uri,title,artist,duration_seconds,source_playlist,added_at,feature_provenance,feature_needs_review)
    VALUES ('${trackID}','${trackID}','spotify:track:${trackID}','Review Queue Test','Cueflow Test',360,'Tech House Vibezz',NOW(),'spotify-library-sync',TRUE)
    ON CONFLICT (id) DO UPDATE SET bpm=0,musical_key='',camelot='',energy=0,groove='',vocal=0,role='',feature_confidence=0,feature_provenance='spotify-library-sync',feature_needs_review=TRUE
  `])
})

test.afterAll(() => {
  execFileSync('psql', [databaseURL, '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM tracks WHERE id='${trackID}'`])
})

test('reviews a synced track and clears it from the queue', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Research 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Review Queue Test' })).toBeVisible()

  await page.getByLabel('BPM').fill('127.8')
  await page.getByLabel('Musical key').fill('A minor')
  await page.getByLabel('Camelot').fill('8A')
  await page.getByLabel('Groove').selectOption('tech-house')
  await page.getByLabel('Set role').selectOption('builder')
  await page.getByLabel('Provenance').fill('Manual structure review + https://example.test/track-evidence')
  await page.getByRole('button', { name: 'Save reviewed features' }).click()

  await expect(page.getByRole('heading', { name: 'Research queue clear' })).toBeVisible()
  const queue = await request.get('http://127.0.0.1:8787/api/research/queue')
  expect(await queue.json()).toEqual([])

  const observations = Number(execFileSync('psql', [databaseURL, '-At', '-c', `SELECT COUNT(*) FROM feature_observations WHERE track_id='${trackID}'`], { encoding: 'utf8' }).trim())
  expect(observations).toBe(7)
})
