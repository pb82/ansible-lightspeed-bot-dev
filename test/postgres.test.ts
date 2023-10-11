import nock from 'nock'
import { sql as originalSql } from '@databases/pg'

import { PostgresPersistence } from '../src/persistence/postgres'
import { RhssoBotUser } from '../src/persistence/interfaces'

const credential = 'dummy'

const query = jest.fn(async () => {
  return Promise.resolve()
})

jest.mock('@databases/pg', () => {
  return {
    __esModule: true,
    sql: (receivedSql: string) => {
      return receivedSql
    },
    default: function fakeCreateConnectionPool (connectionString: string) {
      expect(connectionString).toEqual(`postgresql://${credential}:${credential}@localhost:5432/dummy`)
      return {
        query
      }
    }
  }
})

beforeEach(() => {
  process.env.DATABASE_URL = 'localhost:5432'
  process.env.DATABASE_NAME = 'dummy'
  process.env.DATABASE_USER = 'dummy'
  process.env.DATABASE_PASSWORD = 'dummy'
  nock.disableNetConnect()
})
test('postgres setup works', async () => {
  const pg = new PostgresPersistence()
  await pg.setup()
  expect(query).toBeCalledWith(originalSql`
        CREATE TABLE IF NOT EXISTS bot_installations (
            installation_id text,
            organization_id text,
            PRIMARY KEY(installation_id, organization_id)
        )
    `
  )
})

test('postgres storeRedHatUser works', async () => {
  const pg = new PostgresPersistence()
  const orgId = 'dummy'
  const instId = 'dummy'

  const user: RhssoBotUser = {
    organization_id: orgId,
    installation_id: instId
  }
  await pg.storeRedHatUser(user)
  expect(query).toBeCalledWith(originalSql`
        INSERT INTO bot_installations (installation_id, organization_id)
        VALUES (${orgId}, ${instId})
        ON CONFLICT DO NOTHING
    `
  )
})

test('postgres removeAllUsersForInstallation works', async () => {
  const pg = new PostgresPersistence()
  const instId = 'dummy'
  await pg.removeAllUsersForInstallation(instId)
  expect(query).toBeCalledWith(originalSql`
        DELETE FROM bot_installations
        WHERE installation_id = ${instId}
    `
  )
})

test('postgres getRedHatUserForInstallation works', async () => {
  const pg = new PostgresPersistence()
  const instId = 'dummy'
  await pg.getRedHatUserForInstallation(instId)
  expect(query).toBeCalledWith(originalSql`
        SELECT installation_id, organization_id FROM bot_installations
        WHERE installation_id = ${instId}
    `
  )
})

afterEach(() => {
  query.mockClear()
  nock.cleanAll()
  nock.enableNetConnect()
})
