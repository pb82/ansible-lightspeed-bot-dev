import { getMockReq, getMockRes } from '@jest-mock/express'
import passport from 'passport'
import { handleLogin, handleLoginCallback, stripQueryParams, setupRhssoAuthentication, handleLogout } from '../src/authz/router'
import { getPersistenceProvider } from '../src/persistence'
import { Response, Router } from 'express'
import logger from 'pino'
import { DeprecatedLogger } from 'probot/lib/types'
import { Issuer } from 'openid-client'

test('setupRhssoAuthentication fails if configuration is missing', async () => {
  let error: Error | undefined
  try {
    await setupRhssoAuthentication(Router(), logger() as DeprecatedLogger)
  } catch (err) {
    error = err as Error
  }
  expect(error).toBeDefined()
})
test('setupRhssoAuthentication succeeds if configuration is provided', async () => {
  process.env.AUTHZ_SESSION_KEY = 'dummy'
  process.env.AUTHZ_API_SERVER = 'https://dummy'
  process.env.AUTHZ_SSO_SERVER = 'https://dummy'
  process.env.AUTHZ_AMS_CLIENT_ID = 'dummy'
  process.env.AUTHZ_AMS_CLIENT_SECRET = 'dummy'
  process.env.AUTHZ_SSO_CLIENT_ID = 'dummy'
  process.env.AUTHZ_SSO_CLIENT_SECRET = 'dummy'
  process.env.AUTHZ_REDIRECT_URL = 'https://dummy'

  const router = Router()
  router.get = jest.fn()
  router.use = jest.fn()

  const originalDiscover = Issuer.discover
  Issuer.discover = jest.fn(async (uri: string) => {
    return new Issuer({
      issuer: uri
    })
  })

  try {
    await setupRhssoAuthentication(router, logger() as DeprecatedLogger)
  } finally {
    Issuer.discover = originalDiscover
  }

  expect(router.get).toBeCalled()
  expect(router.use).toBeCalled()
})

test('strip query params', () => {
  const req = getMockReq()
  req.url = 'test.com?installation_id=1234&code=asdf'
  const { res, next } = getMockRes()
  stripQueryParams(req, res, next)
  expect(req.url.indexOf('?')).toBe(-1)
})
test('test handleLogin', () => {
  const originalAuthenticate = passport.authenticate
  try {
    passport.authenticate = jest.fn(strategy => {
      expect(strategy).toBe('oidc')
      return function () {
        return true
      }
    })

    const req = getMockReq()
    req.query.installation_id = '12345'

    const { res, next } = getMockRes()
    handleLogin(req, res, next)

    expect(passport.authenticate).toBeCalled()
  } finally {
    passport.authenticate = originalAuthenticate
  }
})

test('test handleLogin requires installation_id', () => {
  const req = getMockReq()
  const { res, next } = getMockRes()
  res.sendStatus = jest.fn((): Response => {
    return {} as Response
  })

  handleLogin(req, res, next)
  expect(res.sendStatus).toBeCalledWith(400)
})

test('test handleLoginCallback', async () => {
  const req = getMockReq()
  req.query.state = 'inst_id'
  req.user = { organizationId: 'org_id' }

  const { res } = getMockRes()

  process.env.DATABASE_TYPE = 'memory'
  const storage = await getPersistenceProvider()

  const originalStoreRedHatUser = storage.storeRedHatUser
  try {
    storage.storeRedHatUser = jest.fn(async (user) => {
      expect(user.installation_id).toBe('inst_id')
      expect(user.organization_id).toBe('org_id')
    })

    await handleLoginCallback(req, res)
    expect(res.redirect).toBeCalledWith('/auth/user')
  } finally {
    storage.storeRedHatUser = originalStoreRedHatUser
  }
})

test('test handleLogout', () => {
  const req = getMockReq()
  const { res, next } = getMockRes()

  req.logout = jest.fn(function (): void {
    const done = arguments[0]
    return done(null)
  })

  handleLogout(req, res, next)
  expect(req.logout).toBeCalled()
  expect(res.redirect).toBeCalledWith('/auth/user')
})
