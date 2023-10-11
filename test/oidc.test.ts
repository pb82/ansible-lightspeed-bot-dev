import { getOidcClient } from '../src/authz/oidc'
import { Issuer } from 'openid-client'
import nock from 'nock'

beforeEach(() => {
  nock.disableNetConnect()
})
test('getOidcClient succeeds when configuration is provided', async () => {
  process.env.AUTHZ_SSO_CLIENT_ID = 'dummy'
  process.env.AUTHZ_SSO_CLIENT_SECRET = 'dummy'
  process.env.AUTHZ_SSO_SERVER = 'https://dummy'
  process.env.AUTHZ_REDIRECT_URL = 'https://dummy'

  const originalDiscover = Issuer.discover
  Issuer.discover = jest.fn(async (uri: string) => {
    return new Issuer({
      issuer: uri
    })
  })

  try {
    const client = await getOidcClient()
    expect(client).toBeDefined()
  } finally {
    Issuer.discover = originalDiscover
  }
})

test('getOidcClient fails when configuration is missing', async () => {
  let error: Error | undefined
  try {
    await getOidcClient()
  } catch (err) {
    error = err as Error
  }

  expect(error).toBeDefined()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})
