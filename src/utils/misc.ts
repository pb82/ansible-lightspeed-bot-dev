import * as child_process from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import { DeprecatedLogger } from 'probot/lib/types'
import * as fs from 'fs-extra'

export const asyncExec = promisify(child_process.exec)

/**
 * Adjusts the command and environment in case the interpreter path is provided.
 */
export function withInterpreter (
  executable: string,
  args: string,
  interpreterPath: string,
  activationScript?: string
): [string, NodeJS.ProcessEnv | undefined] { // eslint-disable-line
  let command = `${executable} ${args}` // base case

  const newEnv = Object.assign({}, process.env, {
    NO_COLOR: '1', // ensure none of the output produce color characters
    ANSIBLE_FORCE_COLOR: '0', // ensure output is parseable (no ANSI)
    PYTHONBREAKPOINT: '0' // We want to be sure that python debugger is never
    // triggered, even if we mistakenly left a breakpoint() there while
    // debugging ansible-lint, or another tool we call.
  })

  if (activationScript) {
    command = `bash -c 'source ${activationScript} && ${executable} ${args}'`
    return [command, undefined]
  }

  if (interpreterPath) {
    const virtualEnv = path.resolve(interpreterPath, '../..')

    const pathEntry = path.join(virtualEnv, 'bin')

    // emulating virtual environment activation script
    newEnv.VIRTUAL_ENV = virtualEnv
    newEnv.PATH = `${pathEntry}:${process.env.PATH}`
    delete newEnv.PYTHONHOME
  }
  return [command, newEnv]
}

export async function removeLocalDirectory (
  localPath: string,
  logger?: DeprecatedLogger
): Promise<void> {
  try {
    // Check if the localPath path exists
    const exists = await fs.pathExists(localPath)

    if (exists) {
      // Remove the localPath directory
      await fs.remove(localPath)
    } else {
      if (logger) {
        logger.info(`Repository not found at path: ${localPath}`)
      } else {
        console.log(`Repository not found at path: ${localPath}`)
      }
    }
  } catch (error) {
    if (logger) {
      logger.error(`Error removing repository: ${error}`)
    } else {
      console.error(`Error removing repository: ${error}`)
    }
  }
}

export function requireEnvironmentVariables (requiredConfiguration: Array<string>): void {
  for (const item of requiredConfiguration) {
    if (!process.env[item]) {
      throw new Error(`required configuration '${item}' not found in .env`)
    }
  }
}

export function sanitizeConfigInput (configInput: string): string {
  const tempList = configInput.split(' ')
  return tempList[0]
}
