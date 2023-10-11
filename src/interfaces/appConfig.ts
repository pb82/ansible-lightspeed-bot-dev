export interface AnsibleLintConfig {
  rulesDir: string | undefined;
  configFile: string | undefined;
}

export interface BotScheduleConfig {
  interval: string | undefined;
}

export interface AppSettings {
  ansibleLint: AnsibleLintConfig;
  schedule: BotScheduleConfig;
}

export interface AppConfig {
  github_callback_url: string;
  appSettings: AppSettings;
}
