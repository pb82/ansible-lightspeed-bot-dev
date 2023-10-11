import { gitConfigUpdate } from '../src/utils/git'
import { Probot } from 'probot'
import { DeprecatedLogger } from 'probot/lib/types'

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

jest.mock('../src/utils/commandRunner', () => {
  return {
    CommandRunner: jest.fn().mockImplementation(() => {
      return {
        runCommand: jest.fn().mockRejectedValue(new Error('some error'))
      }
    })
  }
})

describe('gitConfigUpdate', () => {
  it('should handle errors and throw an exception', async () => {
    process.env.GH_CONFIG_BOT_MAIL = 'dummy'
    process.env.GH_CONFIG_BOT_USER = 'bad value'

    const probot = new Probot()
    const logger: DeprecatedLogger = probot.log

    await expect(async () => {
      await gitConfigUpdate(logger)
    }).rejects.toThrowError('Failed to set Git configuration with error Error')
  })
})
