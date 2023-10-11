import { DateTime } from 'luxon'
import {
  DAILY_INTERVAL_SCHEDULE,
  WEEKLY_INTERVAL_SCHEDULE,
  MONTHLY_INTERVAL_SCHEDULE
} from '../utils/constants'

interface scheduleTimeInfo {
    currentTimestamp: number
    lastDispatchTime: number
    scheduleIntervalTimestamp: number
}

export async function intervalTimestampCalculator (lastRepoDispatchTime: Date, scheduleInterval: string) {
  // Get the current date and time
  const scheduleIntervalTime:scheduleTimeInfo = {
    currentTimestamp: 0,
    lastDispatchTime: 0,
    scheduleIntervalTimestamp: 0
  }
  const currentTimestamp = DateTime.utc()
  const lastDispatchTime = DateTime.fromJSDate(lastRepoDispatchTime).toUTC()

  let targetTime: DateTime
  switch (scheduleInterval as string) {
    case DAILY_INTERVAL_SCHEDULE: {
      // Set the time to 9 AM
      targetTime = lastDispatchTime.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    }
    case WEEKLY_INTERVAL_SCHEDULE: {
      let nextMonday = lastDispatchTime.plus({ days: 1 }) // Start from tomorrow
      while (nextMonday.weekday !== 1) {
        nextMonday = nextMonday.plus({ days: 1 })
      }
      // Set the time to 9 AM
      targetTime = nextMonday.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    }
    case MONTHLY_INTERVAL_SCHEDULE: {
      const firstDayOfNextMonth = lastDispatchTime.plus({ months: 1 }).startOf('month')
      // Set the time to 9 AM
      targetTime = firstDayOfNextMonth.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    }
    default:
      throw new Error(`Unsupported: ${scheduleInterval}, schedule interval type passed in config!`)
  }
  // Get the timestamp
  scheduleIntervalTime.currentTimestamp = currentTimestamp.toMillis()
  scheduleIntervalTime.lastDispatchTime = lastDispatchTime.toMillis()
  scheduleIntervalTime.scheduleIntervalTimestamp = targetTime.toMillis()
  return scheduleIntervalTime
}
