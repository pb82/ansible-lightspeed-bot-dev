export interface RhssoBotUser {
  organization_id: string
  installation_id: string
}

export interface BotSchedulerInfo {
  owner_name: string
  repo_name: string
  interval: string
  last_pushed_at: Date;
}

export interface PersistentBot {
  setup(): Promise<void>

  storeRedHatUser(user: RhssoBotUser): Promise<void>

  getRedHatUserForInstallation(installationId: string): Promise<RhssoBotUser | null>

  removeAllUsersForInstallation(installationId: string): Promise<void>

  storeBotSchedulerInfo(repo: BotSchedulerInfo): Promise<void>

  getBotSchedulerInfo(owner: string, repo: string): Promise<BotSchedulerInfo | null>

  getAllRepoForOwner (owner: string): Promise<Array<BotSchedulerInfo> | null>

  updateSchedulerLastPushedTime(repo: BotSchedulerInfo): Promise<BotSchedulerInfo | null>

  removeBotSchedulerInfo(owner: string, repo: string): Promise<void>

}
