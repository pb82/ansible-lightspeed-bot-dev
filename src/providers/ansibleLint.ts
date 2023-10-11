import path from 'path'
import fs from 'fs'
import { Context } from 'probot'
import { Octokit } from '@octokit/core'
import {
  BASE_CLONE_PATH,
  PR_TITLE,
  PR_BODY
} from '../utils/constants'
import { AppConfig } from '../interfaces/appConfig'
import { DeprecatedLogger } from 'probot/lib/types'
import {
  gitClone,
  gitCreateBranch,
  gitStatus,
  gitCommitAll,
  gitPush,
  getMainBranchCommitInfo,
  gitBranchQuery,
  gitPullsList,
  gitExistingPullDiff,
  gitDiff
} from '../utils/git'
import { removeLocalDirectory } from '../utils/misc'
import { CommandRunner } from '../utils/commandRunner'

export class AnsibleLintProvider {
  name: string
  appConfig: AppConfig
  logger: DeprecatedLogger
  context: Context<'repository_dispatch'> | Context<'repository.edited'>
  ghToken: string
  runOutput: string[]

  constructor (
    appConfig: AppConfig,
    context: Context<'repository_dispatch'> | Context<'repository.edited'>,
    ghToken: string,
    logger: DeprecatedLogger
  ) {
    this.name = 'ansible-lint'
    this.appConfig = appConfig
    this.context = context
    this.ghToken = ghToken
    this.logger = logger
    this.runOutput = []
  }

  async run () {
    this.logger.info('Running Ansible Lint...')
    const repo = this.context.payload.repository
    const owner = repo.owner.login
    const repoName = repo.name

    const octokit = new Octokit({
      auth: this.ghToken
    })
    const commit_sha = await getMainBranchCommitInfo(octokit, owner, repoName)
    const latestCommitHash = commit_sha.data.sha

    // Clone the repository locally
    const cloneUrl = `https://${owner}:${this.ghToken}@github.com/${owner}/${repoName}.git`
    const localPath = path.join(
      BASE_CLONE_PATH,
      owner,
      repoName,
      latestCommitHash
    )

    const branchName = `bot/ansible-lint/${latestCommitHash}`
    if (await gitBranchQuery(octokit, owner, repoName, branchName, latestCommitHash, this.logger)) {
      this.logger.info(`Ansible Code Bot PR is already on the latest commit over repo: ${repoName} with owner: ${owner}, skipping the scan event!`)
      return
    }
    if (fs.existsSync(localPath)) {
      // remove the local clone
      await removeLocalDirectory(localPath, this.logger)
      this.logger.info(`Removed local clone ${localPath}`)
    }
    await gitClone(cloneUrl, localPath, this.logger)

    let botExistingPullDiff = {
      stdout: '',
      stderr: ''
    }
    const gitPulls = await gitPullsList(octokit, owner, repoName)
    for (const pull of gitPulls.data) {
      if (pull.head.label.includes('bot/ansible-lint')) {
        const pullUrlSplit = pull.head.label.split(':')
        botExistingPullDiff = await gitExistingPullDiff(pullUrlSplit[1], localPath, this.logger)
        break
      }
    }
    await gitCreateBranch(localPath, branchName, this.logger)

    const ansibleLintExecutablePath = await this.getAnsibleLintExecutable(
      localPath
    )
    if (ansibleLintExecutablePath === undefined) {
      return
    }

    await this.runAnsibleLint(ansibleLintExecutablePath, localPath)

    const filesTransformed = await gitStatus(localPath, this.logger)
    if (!filesTransformed) {
      return
    }

    const filesDiff = await gitDiff(localPath)
    const value: boolean = botExistingPullDiff.stdout === filesDiff.stdout
    if (value) {
      this.logger.info(`Verified the existing Bot PR recommendation diff over repo: ${repoName} with owner: ${owner}, and it has the latest Bot recommendation!`)
      // remove the local clone
      await removeLocalDirectory(localPath, this.logger)
      this.logger.info(`Removed local clone ${localPath}`)
    } else {
      await gitCommitAll(
        localPath,
        'Fix ansible-lint rule violations',
        this.logger
      )
      await gitPush(localPath, branchName, cloneUrl, this.logger)
      this.createPullRequest(localPath, branchName)
    }
  }

  async getAnsibleLintExecutable (
    localPath: string
  ): Promise<string | undefined> {
    // Get the path to the ansible-lint executable
    let ansibleLintExecutablePath
    const commandRunner = new CommandRunner()
    try {
      ansibleLintExecutablePath = await commandRunner.getExecutablePath(
        'ansible-lint'
      )
      this.logger.info(
        `ansible-lint executable path is ${ansibleLintExecutablePath}`
      )
    } catch (error) {
      // remove the local clone
      await removeLocalDirectory(localPath, this.logger)
      const errorMessage = `Failed to get ansible-lint executable path with error ${error}`
      this.logger.error(errorMessage)
      throw new Error(errorMessage)
    }
    return ansibleLintExecutablePath
  }

  async runAnsibleLint (ansibleLintExecutablePath: string, localPath: string) {
    // Run ansible-lint command with configuration options
    const configFile = this.appConfig.appSettings.ansibleLint.configFile
    const rulesDir = this.appConfig.appSettings.ansibleLint.rulesDir
    const commandRunner = new CommandRunner()
    this.logger.info(`configFile is ${configFile}`)
    this.logger.info(`rulesDir is ${rulesDir}`)
    try {
      let args = '--exclude .github --format md --fix all'
      if (configFile !== undefined) {
        args = args.concat(` --config-file ${configFile}`)
      }
      if (rulesDir !== undefined) {
        args = args.concat(` --rules-dir ${rulesDir}`)
      }
      this.logger.info(
        `Running ansible-lint command: ${ansibleLintExecutablePath} ${args}`
      )

      const ansibleLintOutput = await commandRunner.runCommand(
        <string>ansibleLintExecutablePath,
        args,
        undefined,
        localPath
      )

      this.runOutput = ansibleLintOutput.stdout.split('\n')
      this.runOutput = this.runOutput.concat(
        ansibleLintOutput.stderr.split('\n')
      )
      this.logger.info(`ansible-lint command run output:\n${this.runOutput}`)
    } catch (error) {
      const errorMessage = `ansible-lint command run output:\n${error}`
      const lines = errorMessage.split('\n')
      this.runOutput = lines.slice(1)
      this.logger.info(errorMessage)
    }
  }

  async createPullRequest (localPath: string, branchName: string) {
    // Raise a pull request
    const pullRequestDescription = this.runOutput.join('\n')
    const repo = this.context.payload.repository
    const title = PR_TITLE
    const body = `${PR_BODY}\n \`\`\`${pullRequestDescription}\`\`\``
    await this.context.octokit.pulls.create({
      owner: repo.owner.login,
      repo: repo.name,
      title,
      body,
      head: branchName,
      base: 'main'
    })
    this.logger.info(
      `Created pull request for branch ${branchName} on repository ${repo.name}`
    )

    // remove the local clone
    await removeLocalDirectory(localPath, this.logger)
    this.logger.info(`Removed local clone ${localPath}`)
  }
}
