import { Issuer, AuthorizationParameters, Strategy, TokenSet } from 'openid-client'
import { requireEnvironmentVariables } from '../utils/misc'

const requiredConfiguration = [
  'AUTHZ_SSO_CLIENT_ID',
  'AUTHZ_SSO_CLIENT_SECRET',
  'AUTHZ_SSO_SERVER',
  'AUTHZ_REDIRECT_URL'
]

// requested scopes from rhsso
const scope: AuthorizationParameters = { scope: 'openid id.organization' }

export async function getOidcClient (): Promise<Strategy<object>> {
  requireEnvironmentVariables(requiredConfiguration)

  const ssoServer = process.env.AUTHZ_SSO_SERVER as string
  const { Client } = await Issuer.discover(ssoServer)
  const client = new Client({
    client_id: process.env.AUTHZ_SSO_CLIENT_ID as string,
    client_secret: process.env.AUTHZ_SSO_CLIENT_SECRET as string,
    redirect_uris: [process.env.AUTHZ_REDIRECT_URL as string],
    response_types: ['code']
  })

  return Promise.resolve(new Strategy({
    client,
    passReqToCallback: true,
    params: scope
  }, (_1, token: TokenSet, _2, done) => {
    const user = token.claims()
    const { id } = user.organization as { id: string }
    return done(null, { organizationId: id })
  }))
}
