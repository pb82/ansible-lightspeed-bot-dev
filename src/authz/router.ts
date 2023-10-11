import { Router, Request, Response, NextFunction } from 'express'
import { DeprecatedLogger } from 'probot/lib/types'
import { getOidcClient } from './oidc'
import session from 'express-session'
import passport from 'passport'
import { getPersistenceProvider, RhssoBotUser } from '../persistence'
import { create as handlebarsCreate } from 'express-handlebars'
import { join as pathJoin } from 'path'
import { getAmsClient } from './ams'
import { requireEnvironmentVariables } from '../utils/misc'

const requiredConfiguration = [
  'AUTHZ_SESSION_KEY'
]

// strips query params from the url. GitHub sends query params in the login request that
// the oidc client's passport strategy can't handle
export function stripQueryParams (req: Request, _: Response, next: NextFunction) {
  req.url = req.originalUrl.split('?')[0]
  return next(null)
}

export function handleLogin (req: Request, res: Response, next: NextFunction) {
  if (!req.query.installation_id) {
    return res.sendStatus(400)
  }

  return passport.authenticate('oidc', {
    state: `${req.query.installation_id}`
  })(req, res, next)
}

export async function handleLoginCallback (req: Request, res: Response) {
  const installationId = req.query?.state
  if (!req.user || req.user as { organizationId: string } === null) {
    return res.sendStatus(403)
  }

  const redHatOrgId = (req.user as { organizationId: string }).organizationId

  const user: RhssoBotUser = {
    organization_id: redHatOrgId,
    installation_id: installationId as string
  }

  const storage = await getPersistenceProvider()
  try {
    await storage.storeRedHatUser(user)
  } catch {
    return res.sendStatus(500)
  }

  return res.redirect('/auth/user')
}

export function handleLogout (req: Request, res: Response, next: NextFunction) {
  req.logout(err => {
    if (err) {
      return next(err)
    }
    return res.redirect('/auth/user')
  })
}

export async function setupRhssoAuthentication (router: Router, logger: DeprecatedLogger) {
  requireEnvironmentVariables(requiredConfiguration)

  const amsClient = getAmsClient()
  const renderer = handlebarsCreate()

  router.use(session({
    secret: process.env.AUTHZ_SESSION_KEY as string,
    saveUninitialized: false,
    resave: false
  }))

  const strategy = await getOidcClient()
  passport.use('oidc', strategy)
  router.use(passport.initialize())
  router.use(passport.session())

  // we can keep the whole user object in the session because we only store orgId and installationId
  passport.serializeUser((user, done) => done(null, user))
  passport.deserializeUser((user: { organization: { id: string } }, done) => done(null, user))

  // called by GitHub on installation of the app
  router.get('/login', stripQueryParams, handleLogin)

  // called by the authentication provider after successful authentication
  router.get('/login/callback',
    passport.authenticate('oidc', { failureRedirect: '/login' }), handleLoginCallback)

  // called by the user if they want to log out
  router.get('/logout', handleLogout)

  router.get('/user', async (req, res) => {
    const viewDir = pathJoin(__dirname, '..', '..', '..', 'views', 'user.handlebars')
    if (req.user) {
      const orgId = (req.user as { organizationId: string }).organizationId
      let orgIsLightspeedSubscriber = false
      try {
        orgIsLightspeedSubscriber = await amsClient.orgIsLightspeedSubscriber(orgId)
      } catch (err) {
        logger.error(err as Error, `failed to check subscription for org ${orgId}`)
      }

      const view = await renderer.render(viewDir, {
        loggedIn: true,
        orgIsLightspeedSubscriber
      })
      return res.send(view)
    } else {
      const view = await renderer.render(viewDir, {
        loggedIn: false
      })
      return res.send(view)
    }
  })

  logger.info('authentication provider is ready')
}
