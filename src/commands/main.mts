import process from "process";
import { Option } from "commander";
import inquirer from "inquirer";
import { findBestMatch } from 'string-similarity';
import { BANG, chalk, error, exit, log, CYAN, USER_AGENT, warn } from '../utils/command-helpers.mjs';
import execa from '../utils/execa.mjs';
import getGlobalConfig from '../utils/get-global-config.mjs';
import getPackageJson from '../utils/get-package-json.mjs';
import { track } from '../utils/telemetry/index.mjs';
import BaseCommand from './base-command.mjs';
import { createHostingCommand } from "./hosting/hosting.mjs";
import { createContentDeliveryCommand } from "./content-delivery/content-delivery.mjs";
import {createReleasesCommand} from "./release/release.mjs";
const SUGGESTION_TIMEOUT = 1e4;
const getVersionPage = async () => {
    // performance optimization - load envinfo on demand
    const envinfo = await import('envinfo');
    const data = await envinfo.run({
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'Yarn', 'npm'],
        Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
        npmGlobalPackages: ['cloudpath-cli'],
    });
    return `
────────────────────┐
 Environment Info   │
────────────────────┘
${data}
${USER_AGENT}
`;
};
/**
 * The main CLI command without any command (root action)
 * @param {import('commander').OptionValues} options
 * @param {import('./base-command.mts').default} command
 */
const mainCommand = async function (options: any, command: any) {
    const globalConfig = await getGlobalConfig();

    if (options.telemetryDisable) {
        globalConfig.set('telemetryDisabled', true);
        console.log('Cloudpath telemetry has been disabled');
        console.log('You can renable it anytime with the --telemetry-enable flag');
        exit();
    }
    if (options.telemetryEnable) {
        globalConfig.set('telemetryDisabled', false);
        console.log('Cloudpath telemetry has been enabled');
        console.log('You can disable it anytime with the --telemetry-disable flag');
        await track('user_telemetryEnabled');
        exit();
    }

    if (command.args[0] === 'version' || options.version) {
        if (options.verbose) {
            const versionPage = await getVersionPage();
            log(versionPage);
        }
        log(USER_AGENT);
        exit();
    }
    // if no command show the header and the help
    if (command.args.length === 0) {
        const pkg = await getPackageJson();
        const title = `${chalk.bgBlack.whiteBright('⬥ Cloudpath CLI')}`;
        const docsMsg = `${chalk.greenBright('Read the docs:')} https://docs.cloudpath.app/cli/get-started/`;
        const supportMsg = `${chalk.blue('Support and bugs:')} ${pkg.bugs.url}`
        console.log();
        console.log(title);
        console.log(docsMsg);
        console.log(supportMsg)
        console.log();
        command.help();
    }

    console.log("command.commands")

    if (command.args[0] === 'help') {
        if (command.args[1]) {
            const subCommand = command.commands.find((cmd: any) => cmd.name() === command.args[1]);
            if (!subCommand) {
                error(`command ${command.args[1]} not found`);
            }
            subCommand.help();
        }
        command.help();
    }

    warn(`${chalk.yellow(command.args[0])} is not a ${command.name()} command.`);
    const allCommands = command.commands.map((cmd: any) => cmd.name());
    const { bestMatch: { target: suggestion }, } = findBestMatch(command.args[0], allCommands);
    const applySuggestion = await new Promise((resolve) => {
        const prompt = inquirer.prompt({
            type: 'confirm',
            name: 'suggestion',
            message: `Did you mean ${chalk.blue(suggestion)}`,
            default: false,
        });
        setTimeout(() => {
            // @ts-ignore
            prompt.ui.close();
            resolve(false);
        }, SUGGESTION_TIMEOUT);
        // eslint-disable-next-line promise/catch-or-return
        prompt.then((value) => resolve(value.suggestion));
    });
    // create new log line
    log();
    if (!applySuggestion) {
        error(`Run ${CYAN(`${command.name()} help`)} for a list of available commands.`);
    }
    await execa(process.argv[0], [process.argv[1], suggestion], { stdio: 'inherit' });
};
/**
 * Creates the `cloudpath-cli` command
 * Promise is needed as the envinfo is a promise
 * @returns {import('./base-command.mts').default}
 */
export const createMainCommand = () => {
    const program = new BaseCommand('cloudpath');
    // register all the commands
    createContentDeliveryCommand(program);
    createHostingCommand(program);
    createReleasesCommand(program);
    program
        .version(USER_AGENT, '-V')
        .showSuggestionAfterError(true)
        .option('--telemetry-disable', 'Disable telemetry')
        .option('--telemetry-enable', 'Enables telemetry')
        // needed for custom version output as we display further environment information
        // commanders version output is set to uppercase -V
        .addOption(new Option('-v, --version').hideHelp())
        .addOption(new Option('--verbose').hideHelp())
        .noHelpOptions()
        .configureOutput({
        outputError: (message, write) => {
            write(` ${chalk.red(BANG)}   Error: ${message.replace(/^error:\s/g, '')}`);
            write(` ${chalk.red(BANG)}   See more help with --help\n`);
        },
    })
        .action(mainCommand);
    return program;
};