import nock from 'nock'
import { RhssoToken, getToken, resetToken, getAmsExternalOrgId, getAmsClient } from '../src/authz/ams'

beforeEach(() => {
  nock.disableNetConnect()
})

function defineEnvVars () {
  process.env.AUTHZ_SSO_SERVER = 'https://sso.redhat.com'
  process.env.AUTHZ_AMS_CLIENT_ID = 'dummy'
  process.env.AUTHZ_AMS_CLIENT_SECRET = 'dummy'
  process.env.AUTHZ_API_SERVER = 'https://api.redhat.com'
}

function deleteEnvVars () {
  delete process.env.AUTHZ_SSO_SERVER
  delete process.env.AUTHZ_AMS_CLIENT_ID
  delete process.env.AUTHZ_AMS_CLIENT_SECRET
  delete process.env.AUTHZ_API_SERVER
}

test('RhssoToken detects when expired', () => {
  let expires = new Date('2022-09-13')
  let token = new RhssoToken('dummy', expires)
  expect(token.expired()).toBeTruthy()

  expires = new Date()
  expires.setMinutes(expires.getMinutes() + 5)
  token = new RhssoToken('dummy', expires)
  expect(token.expired()).toBeFalsy()
  expect(token.get()).toEqual('dummy')
})

test('getToken succeeds', async () => {
  resetToken()
  defineEnvVars()

  nock('https://sso.redhat.com')
    .post('/auth/realms/redhat-external/protocol/openid-connect/token')
    .reply(200, {
      expires_in: 300,
      access_token: 'dummy'
    })

  const token = await getToken()
  expect(token).toBeDefined()
  expect(token.expired()).toBeFalsy()
  expect(token.get()).toEqual('dummy')
})

test('getAmsExternalOrgId succeeds', async () => {
  resetToken()
  defineEnvVars()

  nock('https://sso.redhat.com')
    .post('/auth/realms/redhat-external/protocol/openid-connect/token')
    .reply(200, {
      expires_in: 300,
      access_token: 'dummy'
    })

  const orgParams = new URLSearchParams()
  orgParams.append('search', 'external_id=\'dummy\'')

  nock('https://api.redhat.com')
    .get('/api/accounts_mgmt/v1/organizations')
    .query(orgParams)
    .reply(200, {
      items: [
        { id: '1234567' }
      ]
    })

  const externalId = await getAmsExternalOrgId('dummy')
  expect(externalId).toEqual('1234567')
  expect(nock.pendingMocks()).toEqual([])
})

test('getAmsClient fails if configuration is not provided', async () => {
  deleteEnvVars()

  let error: Error | undefined
  try {
    getAmsClient()
  } catch (err) {
    error = err as Error
  }
  expect(error).toBeDefined()
})

test('orgIsLightspeedSubscriber succeeds', async () => {
  resetToken()
  defineEnvVars()

  nock('https://sso.redhat.com')
    .post('/auth/realms/redhat-external/protocol/openid-connect/token')
    .reply(200, {
      expires_in: 300,
      access_token: 'dummy'
    })

  const orgParams = new URLSearchParams()
  orgParams.append('search', 'external_id=\'dummy\'')

  nock('https://api.redhat.com')
    .get('/api/accounts_mgmt/v1/organizations')
    .query(orgParams)
    .reply(200, {
      items: [
        { id: 'dummy' }
      ]
    })

  const quotaParams = new URLSearchParams()
  quotaParams.append('search', "sku = 'FakeAnsibleWisdom' AND sku_count > 0")

  nock('https://api.redhat.com')
    .get('/api/accounts_mgmt/v1/organizations/dummy/resource_quota')
    .query(quotaParams)
    .reply(200, {
      total: 1
    })

  const amsClient = getAmsClient()
  expect(amsClient).toBeDefined()

  const subscribed = await amsClient.orgIsLightspeedSubscriber('dummy')
  expect(subscribed).toBeTruthy()
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
})
