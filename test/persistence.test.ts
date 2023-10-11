import { getPersistenceProvider, resetPersistenceProvider } from '../src/persistence'
import { MemoryPersistence } from '../src/persistence/memory'
import { PostgresPersistence } from '../src/persistence/postgres'

const credential = 'dummy'
jest.mock('@databases/pg', () => {
  return {
    __esModule: true,
    sql: (receivedSql: string) => {
      return receivedSql
    },
    default: function fakeCreateConnectionPool (connectionString: string) {
      expect(connectionString).toEqual(`postgresql://${credential}:${credential}@localhost:5432/dummy`)
      return {
        query: jest.fn()
      }
    }
  }
})
test('getPersistenceProvider returns the correct persistence provider', async () => {
  resetPersistenceProvider()
  process.env.DATABASE_TYPE = 'memory'
  const storage = await getPersistenceProvider()
  expect(storage).toBeInstanceOf(MemoryPersistence)
})

test('getPersistenceProvider returns the correct persistence provider (postgres)', async () => {
  resetPersistenceProvider()
  process.env.DATABASE_TYPE = 'postgres'
  process.env.DATABASE_URL = 'localhost:5432'
  process.env.DATABASE_NAME = 'dummy'
  process.env.DATABASE_USER = 'dummy'
  process.env.DATABASE_PASSWORD = 'dummy'

  const storage = await getPersistenceProvider()
  expect(storage).toBeInstanceOf(PostgresPersistence)
})
