import { Octokit } from '@octokit/core'
import { DeprecatedLogger } from 'probot/lib/types'
import { CommandRunner } from './commandRunner'
import { removeLocalDirectory } from './misc'
import { GH_CONFIG_EMAIL, GH_CONFIG_NAME } from './constants'
import { requireEnvironmentVariables } from '../utils/misc'

const requiredConfiguration = [
  'GH_CONFIG_BOT_MAIL',
  'GH_CONFIG_BOT_USER'
]

const GH_CONFIG_BOT_MAIL = process.env.GH_CONFIG_BOT_MAIL
const GH_CONFIG_BOT_USER = process.env.GH_CONFIG_BOT_USER

export async function gitConfigUpdate (
  logger: DeprecatedLogger
): Promise<void> {
  requireEnvironmentVariables(requiredConfiguration)
  const commandRunner = new CommandRunner()
  try {
    // Setting the user name and mail config locally and it'll be flushed once the local clone dir is removed after each bot operation
    await commandRunner.runCommand('git', `config --global ${GH_CONFIG_EMAIL} "${GH_CONFIG_BOT_MAIL}"`)
    await commandRunner.runCommand('git', `config --global ${GH_CONFIG_NAME} "${GH_CONFIG_BOT_USER}"`)
    logger.info('Setting Bot git config user.email and user.name completed!')
  } catch (error) {
    const errorMessage = `Failed to set Git configuration with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function gitClone (
  url: string,
  localPath: string,
  logger: DeprecatedLogger
): Promise<void> {
  const commandRunner = new CommandRunner()
  try {
    await commandRunner.runCommand('git', `clone ${url} ${localPath}`)
    logger.info(`Cloning repository to: ${localPath}`)
  } catch (error) {
    const errorMessage = `Failed to clone repository to: ${localPath} with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function gitPullsList (octokit: Octokit, owner: string, repo: string) {
  const gitPullsList = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls',
    {
      owner,
      repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )
  return gitPullsList
}

export async function gitCreateBranch (
  localPath: string,
  branchName: string,
  logger: DeprecatedLogger
) {
  const commandRunner = new CommandRunner()
  try {
    await commandRunner.runCommand(
      'git',
      `checkout -b ${branchName}`,
      undefined,
      localPath
    )
    logger.info(`Created branch ${branchName}`)
  } catch (error) {
    // remove the local clone
    await removeLocalDirectory(localPath, logger)
    logger.info(`Removed local clone ${localPath}`)
    const errorMessage = `Failed to create branch ${branchName} with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function gitBranchQuery (
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  latestCommitHash: string,
  logger: DeprecatedLogger
): Promise<boolean> {
  try {
    const commit_ref = await octokit.request(
      'GET /repos/{owner}/{repo}/branches/{branch}',
      {
        owner,
        repo,
        branch,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    if (commit_ref.data.commit.parents[0].sha === latestCommitHash) {
      return true
    } else {
      return false
    }
  } catch (error) {
    const errorMessage = `Failed to query branch ${branch} with error ${error}`
    logger.info(errorMessage)
    return false
  }
}

export async function getMainBranchCommitInfo (octokit: Octokit, owner: string, repo: string) {
  const mainBranchCommitInfo = await octokit.request(
    'GET /repos/{owner}/{repo}/commits/main',
    {
      owner,
      repo,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )
  return mainBranchCommitInfo
}

export async function gitExistingPullDiff (
  commitBranch: string,
  localPath: string,
  logger: DeprecatedLogger
) {
  const commandRunner = new CommandRunner()
  try {
    // Check if there are any changes
    await commandRunner.runCommand(
      'git',
      'fetch --all',
      undefined,
      localPath
    )
    await commandRunner.runCommand(
      'git',
      `checkout ${commitBranch}`,
      undefined,
      localPath
    )
    const botExistingPullDiff = await commandRunner.runCommand(
      'git',
      `diff origin...${commitBranch} --no-prefix`,
      undefined,
      localPath
    )
    const branch = await commandRunner.runCommand(
      'git',
      'symbolic-ref refs/remotes/origin/HEAD',
      undefined,
      localPath
    )
    const headBranch = branch.stdout.split('/')
    await commandRunner.runCommand(
      'git',
      `checkout ${headBranch[headBranch.length - 1]}`,
      undefined,
      localPath
    )
    await commandRunner.runCommand(
      'git',
      `branch -D ${commitBranch}`,
      undefined,
      localPath
    )
    return botExistingPullDiff
  } catch (error) {
    await removeLocalDirectory(localPath, logger)
    logger.info(`Removed local clone ${localPath}`)
    const errorMessage = `Failed to get existing Pull Diff changes with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function gitDiff (
  localPath: string
) {
  const commandRunner = new CommandRunner()
  // Check if there are any changes
  const statusOutput = await commandRunner.runCommand(
    'git',
    'diff --no-prefix',
    undefined,
    localPath
  )
  return statusOutput
}

export async function gitStatus (
  localPath: string,
  logger: DeprecatedLogger
): Promise<boolean> {
  const commandRunner = new CommandRunner()
  // Check if there are any changes
  const statusOutput = await commandRunner.runCommand(
    'git',
    'status --porcelain',
    undefined,
    localPath
  )
  if (statusOutput.stdout.trim() === '') {
    logger.info(`No changes found after running ansible-lint in ${localPath}`)
    await removeLocalDirectory(localPath, logger)
    logger.info(`Removed local clone ${localPath}`)
    return false
  }
  return true
}

export async function gitCommitAll (
  localPath: string,
  commitMessage: string,
  logger: DeprecatedLogger
) {
  const commandRunner = new CommandRunner()
  try {
    await commandRunner.runCommand('git', 'add .', undefined, localPath)
    await commandRunner.runCommand(
      'git',
      `commit -m "${commitMessage}" --no-verify`,
      undefined,
      localPath
    )
  } catch (error) {
    // remove the local clone
    await removeLocalDirectory(localPath, logger)
    const errorMessage = `Failed to commit changes with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}

export async function gitPush (
  localPath: string,
  branchName: string,
  cloneUrl: string,
  logger: DeprecatedLogger
) {
  const commandRunner = new CommandRunner()
  try {
    await commandRunner.runCommand(
      'git',
      `push ${cloneUrl} ${branchName}`,
      undefined,
      localPath
    )
    logger.info(`Pushed changes to branch ${branchName}`)
  } catch (error) {
    await removeLocalDirectory(localPath, logger)
    logger.info(`Removed local clone ${localPath}`)
    const errorMessage = `Failed to push changes with error ${error}`
    logger.error(errorMessage)
    throw new Error(errorMessage)
  }
}
