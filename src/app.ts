import { ApplicationFunctionOptions, Context, Probot } from 'probot'
import { HelperService } from './services/helper'
import { DiagnosticsService } from './services/diagnostics'
import { getPersistenceProvider } from './persistence'
import { setupRhssoAuthentication, getAmsClient } from './authz'
import { gitConfigUpdate } from './utils/git'
import { BOT_REPO_TOPIC } from './utils/constants'
import { AmsClient } from './authz/ams'
import { PersistentBot } from './persistence/interfaces'
import express, { Router } from 'express'
import path from 'path'
import { RepoScheduler } from './scheduler/repoDispatch'
import fs from 'fs'
import { DeprecatedLogger } from 'probot/lib/types'

// checks if the organization associated with this installation is a lightspeed subscriber
async function verifyInstallation (amsClient: AmsClient, installationId: string): Promise<boolean> {
  const requireLicense = Boolean(process.env.ANSIBLE_BOT_REQUIRE_LICENSE ?? true)
  if (!requireLicense) {
    return Promise.resolve(true)
  }

  const storage: PersistentBot = await getPersistenceProvider()
  const user = await storage.getRedHatUserForInstallation(installationId)
  if (user === null) {
    return Promise.resolve(false)
  }

  const isSubscribed = await amsClient.orgIsLightspeedSubscriber(user.organization_id)
  if (!isSubscribed) {
    return Promise.resolve(false)
  }

  return Promise.resolve(true)
}

function createStaticAssetsRoute (router: Router): void {
  router.use('/', express.static(path.join(__dirname, '..', '..', 'views')))
}

async function setupGit (logger: DeprecatedLogger) {
  if (!fs.existsSync(path.join(__dirname, '..', '..', '.git'))) {
    await gitConfigUpdate(logger)
  } else {
    logger.warn('.git directory present, skip updating global git config')
  }
}

export class WebhookHandler {
  app: Probot
  amsClient: AmsClient

  constructor (app: Probot) {
    this.app = app
    this.amsClient = getAmsClient()
  }

  registerWebhooks () {
    this.app.on('repository.edited', this.handleRepositoryEdited.bind(this))
    this.app.on('repository_dispatch', this.handleRepositoryDispatch.bind(this))
    this.app.on('workflow_job.completed', this.handleWorkflowJobComplete.bind(this))
    this.app.on('installation.created', this.handleInstallationCreated.bind(this))
    this.app.on('installation.deleted', this.handleInstallationDeleted.bind(this))
  }

  async handleRepositoryEdited (context: Context<'repository.edited'>) {
    const installationId = context.payload?.installation?.id
    if (!installationId) {
      throw new Error("installation_id missing in 'repository.edited' event")
    }
    try {
      const repositoryTopic = context.payload.repository.topics
      if (repositoryTopic.includes(BOT_REPO_TOPIC)) {
        const owner = context.payload.repository.owner.login
        const repo = context.payload.repository.name
        context.log.info(`Bot Manual Scan triggered by owner: ${owner} over repo: ${repo}!`)
        const github = await this.app.auth()
        const token = await github.apps.createInstallationAccessToken({ installation_id: installationId })
        const ghToken = token.data.token
        const diagnosticsService = new DiagnosticsService(context.log)
        await diagnosticsService.onRepositoryEdited(context, ghToken)
      } else {
        context.log.info('Repo topics, doesn\'t include a Ansible Lightspeed Bot Scan initiator topic!')
      }
    } catch (err) {
      context.log.error(`Failure while processing Repository Edited Job event with error: ${err}`)
    }
  }

  async handleRepositoryDispatch (context: Context<'repository_dispatch'>) {
    const installationId = context.payload?.installation?.id
    if (!installationId) {
      throw new Error("installation_id missing in 'repository_dispatch' event")
    }
    try {
      const verified = await verifyInstallation(this.amsClient, installationId.toString(10))
      if (!verified) {
        context.log.error(`ignoring 'push' event for installation ${installationId}, 
          because the organization is not entitled to use Ansible code bot.`
        )
        return
      } else {
        context.log.info(`installation '${installationId}' is authorized`)
      }
    } catch (err) {
      context.log.error(`error verifying installation ${installationId}`, err)
      return
    }
    try {
      const github = await this.app.auth()
      const token = await github.apps.createInstallationAccessToken({ installation_id: installationId })
      const ghToken = token.data.token
      const branch = context.payload.branch
      if (branch !== context.payload.repository.default_branch) {
        context.log.info('Not main branch, skipping')
        return
      }
      const owner = context.payload.client_payload.owner as string
      const repo = context.payload?.client_payload.repo as string
      const dispatchPushed = new Date()
      const diagnosticsService = new DiagnosticsService(context.log)
      await diagnosticsService.onRepoDispatch(context, ghToken, owner, repo, dispatchPushed)
    } catch (err) {
      context.log.error(`Failure while processing Repository Dispatch Job event with error: ${err}`)
    }
  }

  async handleWorkflowJobComplete (context: Context<'workflow_job.completed'>) {
    const workflowRepository = context.payload?.repository.name
    context.log.info(`Workflow event generated from repository: ${workflowRepository}`)
    try {
      const repoScheduler = new RepoScheduler(context.log)
      await repoScheduler.generateRepositoryDispatch()
    } catch (err) {
      context.log.error(`Failure while processing Workflow Job event with error: ${err}`)
    }
  }

  async handleInstallationCreated (context: Context<'installation.created'>) {
    const installationId = context.payload.installation.id
    context.log.info(`installation '${installationId}' created`)
  }

  async handleInstallationDeleted (context: Context<'installation.deleted'>) {
    const installationId = context.payload.installation.id
    const storage: PersistentBot = await getPersistenceProvider()
    try {
      await storage.removeAllUsersForInstallation(installationId.toString(10))
    } catch (err) {
      context.log.error(`error removing users for installation ${installationId}`, err)
    }

    context.log.info(`installation '${installationId}' deleted`)
  }
}

export function lightspeedAppFunction (app: Probot, opts: ApplicationFunctionOptions) {
  const logger = app.log

  try {
    (async () => {
      if (!opts.getRouter) {
        throw new Error('getRouter() is required')
      }
      await setupGit(logger)
      await getPersistenceProvider()
      await setupRhssoAuthentication(opts.getRouter('/auth'), logger)
      createStaticAssetsRoute(opts.getRouter('/assets'))
    })()
    const handler = new WebhookHandler(app)
    handler.registerWebhooks()
  } catch (error) {
    const errorMessage = HelperService.getErrorMessage(error)
    logger.error(errorMessage)
    throw error
  }
}
