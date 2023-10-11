import { Context } from 'probot'
import { DeprecatedLogger } from 'probot/lib/types'
import { ConfigService } from './config'
import { getPersistenceProvider, BotSchedulerInfo } from '../persistence'
import { PersistentBot } from '../persistence/interfaces'
import { AnsibleLintProvider } from '../providers/ansibleLint'
import {
  DAILY_INTERVAL_SCHEDULE,
  WEEKLY_INTERVAL_SCHEDULE,
  MONTHLY_INTERVAL_SCHEDULE
} from '../utils/constants'
import { sanitizeConfigInput } from '../utils/misc'

export class DiagnosticsService {
  private logger: DeprecatedLogger

  constructor (logger: DeprecatedLogger) {
    this.logger = logger
  }

  public async onRepositoryEdited (
    context: Context<'repository.edited'>,
    ghToken: string): Promise<void> {
    const configService = await ConfigService.build(this.logger, context)
    await this.runBotRecommendation(configService, context, ghToken)
  }

  public async onRepoDispatch (
    context: Context<'repository_dispatch'>,
    ghToken: string,
    owner: string,
    repo: string,
    dispatchPushed: Date): Promise<void> {
    const configService = await ConfigService.build(this.logger, context)
    const scheduleInterval = this.sanitizeScheduleInterval(
      configService.appConfig.appSettings.schedule.interval as string,
      owner,
      repo
    )
    const storage: PersistentBot = await getPersistenceProvider()
    const botRepoInfo = await storage.getBotSchedulerInfo(owner, repo)
    const repoSchedulerInfo: BotSchedulerInfo = {
      owner_name: owner,
      repo_name: repo,
      interval: scheduleInterval as string,
      last_pushed_at: dispatchPushed
    }
    if (botRepoInfo === null) {
      await storage.storeBotSchedulerInfo(repoSchedulerInfo)
      await this.runBotRecommendation(configService, context, ghToken)
    } else {
      await this.runBotRecommendation(configService, context, ghToken)
      await storage.updateSchedulerLastPushedTime(repoSchedulerInfo)
    }
  }

  public async runBotRecommendation (
    configService: ConfigService,
    context: Context<'repository_dispatch'> | Context<'repository.edited'>,
    ghToken: string): Promise<void> {
    const ansibleLintProvider = new AnsibleLintProvider(
      configService.appConfig,
      context,
      ghToken,
      this.logger
    )
    try {
      ansibleLintProvider.run()
    } catch (error) {
      const errorMessage = `Ansible Lint run failed with error: ${error}`
      this.logger.error(errorMessage)
      throw new Error(errorMessage)
    }
  }

  public sanitizeScheduleInterval (interval: string, owner: string, repo: string): string {
    const tempInterval = sanitizeConfigInput(interval)
    switch (tempInterval) {
      case DAILY_INTERVAL_SCHEDULE: {
        return DAILY_INTERVAL_SCHEDULE
      }
      case WEEKLY_INTERVAL_SCHEDULE: {
        return WEEKLY_INTERVAL_SCHEDULE
      }
      case MONTHLY_INTERVAL_SCHEDULE: {
        return MONTHLY_INTERVAL_SCHEDULE
      }
      default:
        throw new Error(
          `Unsupported: ${tempInterval}, schedule interval type passed in config for repo: ${repo} with owner: ${owner}`
        )
    }
  }
}
