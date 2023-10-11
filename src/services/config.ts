import { Context } from 'probot'
import { DeprecatedLogger } from 'probot/lib/types'
import { AppConfig, AppSettings } from '../interfaces/appConfig'

export class ConfigService {
  static defaultConfig: AppConfig = this.getDefaultConfig()
  readonly appConfig: AppConfig

  private constructor (appConfig: AppConfig) {
    this.appConfig = appConfig
  }

  static async build (
    logger: DeprecatedLogger,
    context?: Context<'repository_dispatch'> |
    Context<'repository.edited'>
  ): Promise<ConfigService> {
    const config = await this.loadConfig(logger, context)
    if (!config) throw new Error('No config was found')
    const errorMessages = ConfigService.validateAppConfig(config)
    if (errorMessages.length > 0) {
      const errorStr = errorMessages.join('\n')
      logger.error(errorStr)
      throw new Error(errorStr)
    }
    return new ConfigService(config)
  }

  private static loadConfig = async (
    logger: DeprecatedLogger,
    context?: Context<'repository_dispatch'> |
    Context<'repository.edited'>
  ): Promise<AppConfig | null> => {
    try {
      const config = this.defaultConfig

      if (context) {
        const defaultSettings = this.getDefaultSettings()
        const botRepoSettings = await context.config<AppSettings>(
          'ansible-code-bot.yml',
          defaultSettings
        )
        if (!botRepoSettings) {
          logger.debug(
            'No ansible-code-bot.yml file found in the repo, using defaults...'
          )
        } else {
          logger.debug(
            `Loaded repository bot settings: ${JSON.stringify(
              botRepoSettings
            )}`
          )
        }

        config.appSettings = botRepoSettings || defaultSettings
        logger.info(`Loaded app config: ${JSON.stringify(config)}`)
      }
      return config
    } catch (error) {
      const msg = `Exception while loading config: ${(error as Error).message}`
      context?.log.error(msg)
      throw new Error(msg)
    }
  }

  private static getDefaultSettings (): AppSettings {
    return {
      ansibleLint: {
        rulesDir: undefined,
        configFile: undefined
      },
      schedule: {
        interval: undefined
      }
    }
  }

  private static getDefaultConfig (): AppConfig {
    const defaultConfig = {
      github_callback_url: process.env.CALLBACK_URL || '',
      appSettings: this.getDefaultSettings()
    }
    return defaultConfig
  }

  private static validateAppConfig (config: AppConfig): string[] {
    // TODO: validate config
    const errorMessages: string[] = []
    if (!config.github_callback_url) {
      // TODO: add error message
    }
    return errorMessages
  }
}
