import fetch from 'node-fetch'
import { requireEnvironmentVariables } from '../utils/misc'

const requestTimeout = 2000

const requiredConfiguration = [
  'AUTHZ_API_SERVER',
  'AUTHZ_SSO_SERVER',
  'AUTHZ_AMS_CLIENT_ID',
  'AUTHZ_AMS_CLIENT_SECRET'
]

export interface AmsClient {
  orgIsLightspeedSubscriber(orgId: string): Promise<boolean>
}

export class RhssoToken {
  accessToken: string
  expires: Date

  constructor (accessToken: string, expires: Date) {
    this.accessToken = accessToken
    this.expires = expires
  }

  get (): string {
    return this.accessToken
  }

  expired (): boolean {
    const now = new Date()
    return now > this.expires
  }
}

let currentToken: RhssoToken | null = null

export function resetToken (): void {
  currentToken = null
}

export async function getToken (): Promise<RhssoToken> {
  if (currentToken && !currentToken.expired()) {
    return new Promise(resolve => {
      return resolve(currentToken as RhssoToken)
    })
  }

  const api = '/auth/realms/redhat-external/protocol/openid-connect/token'
  const url = new URL(api, process.env.AUTHZ_SSO_SERVER)
  const data = new URLSearchParams()
  data.append('grant_type', 'client_credentials')
  data.append('client_id', process.env.AUTHZ_AMS_CLIENT_ID as string)
  data.append('client_secret', process.env.AUTHZ_AMS_CLIENT_SECRET as string)
  data.append('scope', 'api.iam.access')

  const response = await fetch(url, {
    body: data,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'post',
    timeout: requestTimeout
  })

  const jsonData = await response.json()
  const expires = jsonData.expires_in
  const accessToken = jsonData.access_token
  const expirationDate = new Date()
  expirationDate.setSeconds(expirationDate.getSeconds() + expires - 60)
  currentToken = new RhssoToken(accessToken, expirationDate)
  return Promise.resolve(currentToken)
}

/**
 * translates a publicly known Red Hat organization id into an internal id
 * @param orgId Red Hat organization id
 */
export async function getAmsExternalOrgId (orgId: string): Promise<string> {
  const token = await getToken()
  const url = new URL('/api/accounts_mgmt/v1/organizations', process.env.AUTHZ_API_SERVER)

  const params = new URLSearchParams()
  params.append('search', `external_id='${orgId}'`)
  url.search += params

  const response = await fetch(url, {
    timeout: requestTimeout,
    headers: {
      Authorization: `Bearer ${token.get()}`
    }
  })

  const jsonData = await response.json()
  if (jsonData.items && jsonData.items.length > 0) {
    return Promise.resolve(jsonData.items[0].id)
  }

  throw new Error(`cannot find external id for org ${orgId}`)
}

export function getAmsClient (): AmsClient {
  requireEnvironmentVariables(requiredConfiguration)

  return {
    /**
     * checks if the given organization has quota for the lightspeed SKU
     * @param orgId Red Hat organization id
     */
    async orgIsLightspeedSubscriber (orgId: string): Promise<boolean> {
      const token = await getToken()
      const externalId = await getAmsExternalOrgId(orgId)

      const api = `/api/accounts_mgmt/v1/organizations/${externalId}/resource_quota`
      const url = new URL(api, process.env.AUTHZ_API_SERVER)

      const params = new URLSearchParams()
      params.append('search', "sku = 'FakeAnsibleWisdom' AND sku_count > 0")
      url.search += params

      const response = await fetch(url, {
        timeout: requestTimeout,
        headers: {
          Authorization: `Bearer ${token.get()}`
        }
      })

      const jsonData = await response.json()
      if (jsonData.total && jsonData.total > 0) {
        return Promise.resolve(true)
      }
      return Promise.resolve(false)
    }
  }
}
