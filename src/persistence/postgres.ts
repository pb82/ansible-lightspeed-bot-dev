import { PersistentBot, RhssoBotUser, BotSchedulerInfo } from './interfaces'
import { requireEnvironmentVariables } from '../utils/misc'
import createConnectionPool, { sql } from '@databases/pg'
import ConnectionPool from '@databases/pg/lib/ConnectionPool'

export class PostgresPersistence implements PersistentBot {
  requiredConfig = [
    'DATABASE_URL',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD'
  ]

  db: ConnectionPool | undefined
  scheduleDb: ConnectionPool | undefined

  constructor () {
    requireEnvironmentVariables(this.requiredConfig)
    const databaseUrl = process.env.DATABASE_URL
    const databaseName = process.env.DATABASE_NAME
    const databaseUser = process.env.DATABASE_USER
    const databasePassword = process.env.DATABASE_PASSWORD
    const connectionString = `postgresql://${databaseUser}:${databasePassword}@${databaseUrl}/${databaseName}`
    this.db = createConnectionPool(connectionString) as ConnectionPool
  }

  async setup () {
    await this.createInstallationTables()
    await this.createSchedulerTables()
  }

  private async createInstallationTables () {
    const query = sql`
        CREATE TABLE IF NOT EXISTS bot_installations (
            installation_id text,
            organization_id text,
            PRIMARY KEY(installation_id, organization_id)
        )
    `
    await this.db?.query(query)
  }

  private async createSchedulerTables () {
    const query = sql`
        CREATE TABLE IF NOT EXISTS repo_scheduler (
            owner_name text,
            repo_name text,
            interval text,
            last_pushed_at timestamptz NOT NULL,
            PRIMARY KEY(owner_name, repo_name)
        )
    `
    await this.db?.query(query)
  }

  async getRedHatUserForInstallation (installationId: string): Promise<RhssoBotUser | null> {
    const query = sql`
        SELECT installation_id, organization_id FROM bot_installations
        WHERE installation_id = ${installationId}
    `
    const result = await this.db?.query(query)
    if (!result || result.length === 0) {
      return Promise.resolve(null)
    }
    return Promise.resolve(result[0] as RhssoBotUser)
  }

  async storeRedHatUser (user: RhssoBotUser): Promise<void> {
    const query = sql`
        INSERT INTO bot_installations (installation_id, organization_id)
        VALUES (${user.installation_id}, ${user.organization_id})
        ON CONFLICT DO NOTHING
    `
    await this.db?.query(query)
    return Promise.resolve()
  }

  async removeAllUsersForInstallation (installationId: string): Promise<void> {
    const query = sql`
        DELETE FROM bot_installations
        WHERE installation_id = ${installationId}
    `
    await this.db?.query(query)
    return Promise.resolve()
  }

  async storeBotSchedulerInfo (repo: BotSchedulerInfo): Promise<void> {
    const query = sql`
        INSERT INTO repo_scheduler (owner_name, repo_name, interval, last_pushed_at)
        VALUES (${repo.owner_name}, ${repo.repo_name}, ${repo.interval}, ${repo.last_pushed_at})
    `
    await this.scheduleDb?.query(query)
    return Promise.resolve()
  }

  async getBotSchedulerInfo (owner: string, repo: string): Promise<BotSchedulerInfo | null> {
    const query = sql`
        SELECT owner_name, repo_name, interval, last_pushed_at FROM repo_scheduler
        WHERE owner_name = ${owner} and repo_name = ${repo}
    `
    const result = await this.scheduleDb?.query(query)
    if (!result || result.length === 0) {
      return Promise.resolve(null)
    }
    return Promise.resolve(result[0] as BotSchedulerInfo)
  }

  async getAllRepoForOwner (owner: string): Promise<Array<BotSchedulerInfo> | null> {
    const query = sql`
        SELECT * FROM repo_scheduler
        WHERE owner_name = ${owner}
    `
    const result = await this.scheduleDb?.query(query)
    if (!result || result.length === 0) {
      return Promise.resolve(null)
    }
    return Promise.resolve(result)
  }

  async updateSchedulerLastPushedTime (repo: BotSchedulerInfo): Promise<BotSchedulerInfo | null> {
    const query = sql`
        UPDATE repo_scheduler SET last_pushed_at = ${repo.last_pushed_at}
        WHERE owner_name = ${repo.owner_name} and repo_name = ${repo.repo_name}
    `
    const result = await this.scheduleDb?.query(query)
    if (!result || result.length === 0) {
      return Promise.resolve(null)
    }
    return Promise.resolve(result[0] as BotSchedulerInfo)
  }

  async removeBotSchedulerInfo (owner: string, repo: string): Promise<void> {
    const query = sql`
        DELETE FROM repo_scheduler
        WHERE owner_name = ${owner} and repo_name = ${repo}
    `
    await this.scheduleDb?.query(query)
    return Promise.resolve()
  }
}
