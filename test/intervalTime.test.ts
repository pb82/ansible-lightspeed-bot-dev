import { intervalTimestampCalculator } from '../src/scheduler/intervalTime'

test('intervalTimestampCalculator for daily schedule', async () => {
  // Thursday, October 5, 2023 6:30:26.417 PM
  const dateString = '2023-10-05T18:30:26.417Z'
  const dateObject = new Date(dateString)
  const lastRepoDispatchTime = new Date(dateObject)
  const scheduleInterval = 'daily'

  const dailyRunTime = await intervalTimestampCalculator(lastRepoDispatchTime, scheduleInterval)

  expect(dailyRunTime.scheduleIntervalTimestamp).toBe(1696496400000)
})

test('intervalTimestampCalculator for weekly schedule', async () => {
  // Thursday, October 5, 2023 6:30:26.417 PM
  const dateString = '2023-10-05T18:30:26.417Z'
  const dateObject = new Date(dateString)
  const lastRepoDispatchTime = new Date(dateObject)
  const scheduleInterval = 'weekly'

  const dailyRunTime = await intervalTimestampCalculator(lastRepoDispatchTime, scheduleInterval)
  // Monday, October 9, 2023 9:00:00 AM
  expect(dailyRunTime.scheduleIntervalTimestamp).toBe(1696842000000)
})

test('intervalTimestampCalculator for monthly schedule', async () => {
  // Thursday, October 5, 2023 6:30:26.417 PM
  const dateString = '2023-10-05T18:30:26.417Z'
  const dateObject = new Date(dateString)
  const lastRepoDispatchTime = new Date(dateObject)
  const scheduleInterval = 'monthly'

  const dailyRunTime = await intervalTimestampCalculator(lastRepoDispatchTime, scheduleInterval)
  // Wednesday, November 1, 2023 9:00:00 AM UTC
  expect(dailyRunTime.scheduleIntervalTimestamp).toBe(1698829200000)
})

test('intervalTimestampCalculator for bi-weekly schedule', async () => {
  // Thursday, October 5, 2023 6:30:26.417 PM
  const dateString = '2023-10-05T18:30:26.417Z'
  const dateObject = new Date(dateString)
  const lastRepoDispatchTime = new Date(dateObject)
  const scheduleInterval = 'bi-weekly'

  let error: Error | undefined
  try {
    await intervalTimestampCalculator(lastRepoDispatchTime, scheduleInterval)
  } catch (err) {
    error = err as Error
  }
  expect(error).toBeDefined()
})
