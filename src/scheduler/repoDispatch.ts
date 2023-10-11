import { Octokit } from '@octokit/rest'
import { App } from '@octokit/app'
import { DeprecatedLogger } from 'probot/lib/types'
import { getPersistenceProvider, BotSchedulerInfo } from '../persistence'
import { PersistentBot } from '../persistence/interfaces'
import { intervalTimestampCalculator } from './intervalTime'

const TOKEN = process.env.GITHUB_TOKEN
const APP_ID = process.env.APP_ID
const PRIVATE_KEY = process.env.PRIVATE_KEY
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET

export class RepoScheduler {
  private logger: DeprecatedLogger

  constructor (logger: DeprecatedLogger) {
    this.logger = logger
  }

  async generateRepositoryDispatch () {
    try {
      const octokit_app = new App({
        appId: APP_ID!,
        privateKey: PRIVATE_KEY!,
        oauth: {
          clientId: GITHUB_CLIENT_ID!,
          clientSecret: GITHUB_CLIENT_SECRET!
        },
        webhooks: {
          secret: WEBHOOK_SECRET!
        }
      })
      const storage: PersistentBot = await getPersistenceProvider()
      for await (const { repository } of octokit_app.eachRepository.iterator()) {
        const owner = repository.owner.login
        const repo = repository.name
        const event_type = 'BOT Repository Disptach Event'
        this.logger.info(`Owner name ${owner} and repo Name: ${repo}`)
        const repoScheduleInfo = await this.getRepoScheduleInfo(owner, repo, storage)
        if (repoScheduleInfo === null) {
          await this.fireRepoDispatch(owner, repo, event_type)
        } else {
          try {
            if (await this.checkForNextRun(repoScheduleInfo)) {
              await this.fireRepoDispatch(owner, repo, event_type)
            }
          } catch (error) {
            this.logger.info(`Owner name ${owner} and repo Name: ${repo} scheduling failed with error: ${error}`)
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failure while trying to generate repository dispatch event with error: ${error}`)
      throw error
    }
  }

  async fireRepoDispatch (owner: string, repo: string, event_type: string) {
    const client_payload = {
      owner,
      repo
    }
    const octokit_new_rest = new Octokit({
      auth: TOKEN,
      timeZone: 'Etc/UTC',
      baseUrl: 'https://api.github.com',
      request: {
        agent: undefined,
        fetch: undefined,
        timeout: 0
      }
    })
    const repo_dispatch = await octokit_new_rest.rest.repos.createDispatchEvent({
      owner,
      repo,
      event_type,
      client_payload
    })
    this.logger.info(`Repo Dispatch Event status: ${repo_dispatch.status}`)
  }

  async getRepoScheduleInfo (owner: string, repo: string, storage: PersistentBot) {
    const botRepoInfo = await storage.getBotSchedulerInfo(owner, repo)
    if (botRepoInfo === null) {
      return null
    } else {
      return botRepoInfo
    }
  }

  async checkForNextRun (repoScheduler: BotSchedulerInfo) {
    let nextRunTime = null
    nextRunTime = await intervalTimestampCalculator(repoScheduler.last_pushed_at, repoScheduler.interval)
    this.logger.info(`Schedule Interval at the repo: ${repoScheduler.interval}`)
    this.logger.info(`Current Timestamp: '${nextRunTime.currentTimestamp}'
      Last Repo Dispatch time: '${nextRunTime.lastDispatchTime}'
      Schedule based timestamp: '${nextRunTime.scheduleIntervalTimestamp}'`
    )
    if (nextRunTime.currentTimestamp >= nextRunTime.scheduleIntervalTimestamp && nextRunTime.lastDispatchTime < nextRunTime.scheduleIntervalTimestamp) {
      return true
    } else {
      return false
    }
  }
}
