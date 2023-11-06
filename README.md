![Cloudpath CLI](cli.png)

[![npm version][npm-img]][npm] [![downloads][dl-img]][dl]

Interact with [Cloudpath](https://cloudpath.app/) from the comfort of your CLI.

See the [CLI command line reference](https://cli.cloudpath.app/commands/) to get started.

## Table of Contents

<details>
<summary>Click to expand</summary>

- [Installation](#installation)
- [Usage](#usage)
- [Documentation](#documentation)
- [Commands](#commands)
  - [cdn](#cdn)
  - [hosting](#hosting)
  - [login](#login)
  - [release](#release)
- [Contributing](#contributing)
- [Development](#development)
- [License](#license)

</details>

## Installation

Cloudpath CLI requires [Node.js](https://nodejs.org) version 14 or above. To install, run the following command from any
directory in your terminal:

```bash
npm install @cloudpath/cli -g
```

When using the CLI in a CI environment we recommend installing it locally as a development dependency, instead of
globally. To install locally, run the following command from the root directory of your project:

```bash
npm install --save-dev @cloudpath/cli
```

## Usage

Installing the CLI globally provides access to the `cloudpath` command.

```sh-session
cloudpath [command]

# Run `help` for detailed information about CLI commands
cloudpath [command] help
```

## Documentation

To learn how to log in to Cloudpath and start deploying sites, visit the
[documentation on Cloudpath](https://docs.cloudpath.app/cli/get-started/).

## Commands

### [cdn](/docs/commands/cdn.md)

Various content delivery commands.

| Subcommand                                                  | description                                                           |
|:------------------------------------------------------------|:----------------------------------------------------------------------|
| [`cdn:buckets:create`](/docs/commands/cdn.md#bucketscreate) | Create a new bucket                                                   |
| [`cdn:buckets:list`](/docs/commands/cdn.md#bucketslist)     | List existing buckets.                                                |
| [`cdn:upload`](/docs/commands/cdn.md#upload)                | Upload a single or multiple of files to a bucket directory.           |

### [hosting](/docs/commands/hosting.md)

Various website hosting commands.

| Subcommand                                                                       | description                                                                          |
|:---------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------|
| [`hosting:deploy`](/docs/commands/hosting.md#deploy)                             | Create a new deploy from the contents of a folder.                                   |
| [`hosting:sites:create`](/docs/commands/hosting.md#sitescreate)                  | Create a new site.                                                                   |
| [`hosting:sites:list`](/docs/commands/hosting.md#siteslist)                      | List your existing sites                                                             |
| [`hosting:sites:delete`](/docs/commands/hosting.md#sitesdelete)                  | Delete a site.                                                                       |
| [`hosting:sites:releases:list`](/docs/commands/hosting.md#sitesreleaseslist)     | List a site's releases.                                                              |
| [`hosting:sites:releases:create`](/docs/commands/hosting.md#sitesreleasescreate) | Create a site release by distribution group or release track (ex: stable, beta, etc) |

### [login](/docs/commands/login.md)

Login to your Cloudpath account

### [release](/docs/commands/release.md)

Handle various site operations

| Subcommand                                                                                 | description                                  |
|:-------------------------------------------------------------------------------------------|:---------------------------------------------|
| [`release:applications:list`](/docs/commands/release.md#applicationslist)                  | List existing release applications.          |
| [`release:applications:distribution-groups`](/docs/commands/sites.md#sitescreate-template) | (Beta) Create a site from a starter template |
| [`release:applications:distribution-groups`](/docs/commands/sites.md#sitesdelete)                                      | Delete a site                                |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more info on how to make contributions to this project.

## Development

You'll need to follow these steps to run Cloudpath CLI locally:

    uninstall any globally installed versions of @cloudpath/cli
    clone and install deps for https://github.com/cloudpath-software/cli
    npm link from inside the cli folder

Now you're both ready to start testing and to contribute to the project!

## License

MIT. See [LICENSE](LICENSE) for more details.

[dl]: https://npmjs.org/package/@cloudpath/cli
