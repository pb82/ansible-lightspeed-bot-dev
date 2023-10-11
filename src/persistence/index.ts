import { PersistentBot, RhssoBotUser, BotSchedulerInfo } from './interfaces'
import { MemoryPersistence } from './memory'
import { PostgresPersistence } from './postgres'

export { RhssoBotUser }
export { BotSchedulerInfo }

const requiredConfiguration = [
  'DATABASE_TYPE'
]

let instance: PersistentBot | undefined

export function resetPersistenceProvider () {
  instance = undefined
}
export async function getPersistenceProvider (): Promise<PersistentBot> {
  for (const item of requiredConfiguration) {
    if (!process.env[item]) {
      throw new Error(`required configuration '${item}' not found in .env`)
    }
  }

  switch (process.env.DATABASE_TYPE as string) {
    case 'memory':
      if (!instance) {
        instance = new MemoryPersistence()
        await instance.setup()
      }
      return Promise.resolve(instance)
    case 'postgres':
      if (!instance) {
        instance = new PostgresPersistence()
        await instance.setup()
      }
      return Promise.resolve(instance)
    default:
      throw new Error(`unsupported database type ${process.env.DATABASE_TYPE}`)
  }
}
