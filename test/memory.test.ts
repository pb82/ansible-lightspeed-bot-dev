import { MemoryPersistence } from '../src/persistence/memory'
import { RhssoBotUser } from '../src/persistence/interfaces'

test('memory persistence works', async () => {
  const storage = new MemoryPersistence()
  const user: RhssoBotUser = {
    organization_id: 'dummy_organization',
    installation_id: 'dummy_installation'
  }

  await storage.storeRedHatUser(user)

  const storedUser = await storage.getRedHatUserForInstallation('dummy_installation')
  expect(storedUser).toEqual(user)

  user.organization_id = 'dummy2_organization'
  await storage.storeRedHatUser(user)
  const updatedUser = await storage.getRedHatUserForInstallation('dummy_installation')
  expect(updatedUser?.organization_id).toEqual('dummy2_organization')
  expect(storage.users).toHaveLength(1)

  await storage.removeAllUsersForInstallation('dummy_installation')
  expect(storage.users).toHaveLength(0)
})

test('memory persistence user not found', async () => {
  const storage = new MemoryPersistence()

  const user = await storage.getRedHatUserForInstallation('dummy_installation')
  expect(user?.organization_id).toBeUndefined()

  await storage.removeAllUsersForInstallation('dummy_installation')
  expect(storage.users).toHaveLength(0)
})

test('memory persistence delete empty installation id', async () => {
  const storage = new MemoryPersistence()

  const user: RhssoBotUser = {
    organization_id: 'dummy_organization',
    installation_id: 'dummy_installation'
  }

  await storage.storeRedHatUser(user)

  await storage.removeAllUsersForInstallation('')
  expect(storage.users).toHaveLength(1)
})
