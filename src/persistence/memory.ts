import { PersistentBot, RhssoBotUser, BotSchedulerInfo } from './interfaces'

export class MemoryPersistence implements PersistentBot {
  users: Array<RhssoBotUser> = []

  async setup (): Promise<void> {
    return Promise.resolve()
  }

  async getRedHatUserForInstallation (installationId: string): Promise<RhssoBotUser | null> {
    for (const user of this.users) {
      if (user.installation_id === installationId) {
        return Promise.resolve({ ...user })
      }
    }
    return Promise.resolve(null)
  }

  async storeRedHatUser (user: RhssoBotUser): Promise<void> {
    for (const existingUser of this.users) {
      if (existingUser.installation_id === user.installation_id) {
        existingUser.organization_id = user.organization_id
        return
      }
    }
    this.users.push({ ...user })
    return Promise.resolve()
  }

  async removeAllUsersForInstallation (installationId: string): Promise<void> {
    if (!installationId) return

    this.users = this.users.filter(value => {
      return value.installation_id !== installationId
    })

    return Promise.resolve()
  }

  async storeBotSchedulerInfo (repo: BotSchedulerInfo): Promise<void> {
    console.log(repo)
    return Promise.resolve()
  }

  async getBotSchedulerInfo (owner: string, repo: string): Promise<BotSchedulerInfo | null> {
    console.log(owner, repo)
    return Promise.resolve(null)
  }

  async getAllRepoForOwner (owner: string): Promise<Array<BotSchedulerInfo> | null> {
    console.log(owner)
    return Promise.resolve(null)
  }

  async updateSchedulerLastPushedTime (repo: BotSchedulerInfo): Promise<BotSchedulerInfo | null> {
    console.log(repo)
    return Promise.resolve(null)
  }

  async removeBotSchedulerInfo (owner: string, repo: string): Promise<void> {
    console.log(owner, repo)
    return Promise.resolve()
  }
}
