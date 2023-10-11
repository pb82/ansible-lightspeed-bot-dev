import { lightspeedAppFunction } from './app'
import { ApplicationFunctionOptions, Probot, run } from 'probot'

function defaultApp (_: Probot, { getRouter }: ApplicationFunctionOptions) {
  if (!getRouter) {
    throw new Error('getRouter() is required for defaultApp')
  }
  const router = getRouter()
  router.get('/', (_, res) => res.redirect('/auth/user'))
  router.get('/probot', (_, res) => res.redirect('/auth/user'))
}

run(lightspeedAppFunction).then(server => {
  server.load(defaultApp).then(() => {
    server.log.info('default app loaded')
  })
})
