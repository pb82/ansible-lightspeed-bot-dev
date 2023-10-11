# ansible-code-bot

> A GitHub App built with [Probot](https://github.com/probot/probot) that utilizes Ansible Lightspeed.

## Setup

```sh
# Install dependencies
npm install

# Install python dependencies
pip install -r requirements.txt

# Run the bot in development mode
LOG_LEVEL=trace npm run dev
```

### Note

After changing the code stop the bot and rerun it for the latest changes to reflect

### Update Bot .env

For Ansible code bot to function as expected, bot environment variables need to be set under `.env` file, following are the envrionment variables that need to be set:

1. Github config related environment variables:

```bash
    GH_CONFIG_BOT_MAIL=no-reply
    GH_CONFIG_BOT_USER=Ansible Code Bot
```

2. Redhat Ansible SSO authentication environment variables:

```bash
    AUTHZ_SSO_CLIENT_ID=<rhsso client id>
    AUTHZ_SSO_CLIENT_SECRET=<rhsso client secret>
    AUTHZ_SSO_SERVER=<rhsso server>
    AUTHZ_REDIRECT_URL=http://localhost:3000/auth/login/callback
    AUTHZ_API_SERVER=https://api.openshift.com
    AUTHZ_SESSION_KEY=secretkey
    AUTHZ_AMS_CLIENT_ID=<ams client id>
    AUTHZ_AMS_CLIENT_SECRET=<ams client secret>
    DATABASE_TYPE=memory
```

- DATABASE_TYPE can also be set to postgres, for example:

```bash
    DATABASE_TYPE=postgres
    DATABASE_URL=localhost:5432
    DATABASE_USER=bot
    DATABASE_PASSWORD=bot
    DATABASE_NAME=ansible-wisdom-bot
```

NOTE: Enviroment variable should be set before firing any request

## Register app

Follow the instructions here:
<https://probot.github.io/docs/development/#configuring-a-github-app>

Ensure that the GitHub app is only available/installable on your account

> Where can this GitHub App be installed?
> Only on this account
> [X] Only allow this GitHub App to be installed on the $YOUR_USERNAME account.
> Any account
> [ ] Allow this GitHub App to be installed by any user or organization.

## Contributing

If you have suggestions for how ansible-code-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE) © 2023 Red Hat
