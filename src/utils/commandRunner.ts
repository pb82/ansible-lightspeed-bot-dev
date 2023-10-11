import { asyncExec, withInterpreter } from './misc'

export class CommandRunner {
  public async runCommand (
    executablePath: string,
    args: string,
    interpreterPath = 'python3',
    workingDirectory?: string
  ): Promise<{
    stdout: string;
    stderr: string;
  }> {
    // prepare command and env for local run
    const [command, runEnv] = withInterpreter(executablePath, args, interpreterPath)

    const result = await asyncExec(command, {
      encoding: 'utf-8',
      cwd: workingDirectory,
      env: runEnv
    })

    return result
  }

  /**
   * A method to return the path to the provided executable
   * @param executable String representing the name of the executable
   * @returns Complete path of the executable (string) or undefined depending upon the presence of the executable
   */
  public async getExecutablePath (
    executable: string
  ): Promise<string | undefined> {
    const executablePath = undefined
    try {
      const commandOutput = await this.runCommand(
        'command',
        `-v ${executable}`
      )
      return commandOutput.stdout.trim()
    } catch (error) {
      // TODO: log error
    }

    try {
      const commandOutput = await this.runCommand('whereis', executable)
      const outParts = commandOutput.stdout.split(':')
      return outParts.length >= 2 ? outParts[1].trim() : undefined
    } catch (error) {
      console.log(error)
    }
    return executablePath
  }
}
