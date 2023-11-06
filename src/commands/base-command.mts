import process from 'process';
import {format} from 'util';
// @ts-ignore
import {resolveConfig} from '@netlify/config';
import {Command, Option} from 'commander';
import debug from 'debug';
import {AuthorizationTokenType, AuthorizationType, Api, UrlScheme} from "@cloudpath/js-api";
import {getAgent} from '../lib/http-agent.mjs';
import {
    chalk,
    CYAN,
    error,
    exit,
    getToken,
    log,
    normalizeConfig,
    padLeft,
    pollForToken,
    sortOptions,
    USER_AGENT,
    warn,
} from '../utils/command-helpers.mjs';
import getGlobalConfig from '../utils/get-global-config.mjs';
import openBrowser from '../utils/open-browser.mjs';
import StateConfig from '../utils/state-config.mjs';
import {track} from '../utils/telemetry/index.mjs';
// TODO: setup client for multiple environments
const CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750';
const NANO_SECS_TO_MSECS = 1e6;
// The fallback width for the help terminal
const FALLBACK_HELP_CMD_WIDTH = 80;
const HELP_$ = CYAN('$');
// indent on commands or description on the help page
const HELP_INDENT_WIDTH = 2;
// separator width between term and description
const HELP_SEPARATOR_WIDTH = 5;
/**
 * Formats a help list correctly with the correct indent
 * @param {string[]} textArray
 * @returns
 */
const formatHelpList = (textArray: string[]) => textArray.join('\n').replace(/^/gm, ' '.repeat(HELP_INDENT_WIDTH));
/**
 * Get the duration between a start time and the current time
 * @param {bigint} startTime
 * @returns
 */
const getDuration = function (startTime: bigint) {
    const durationNs = process.hrtime.bigint() - startTime;
    return Math.round(Number(durationNs / BigInt(NANO_SECS_TO_MSECS)));
};
/**
 * The cloudpath object inside each command with the state
 * @typedef Options
 * @type {object}
 * @property {import('@cloudpath/js-api').Api} api
 * @property {*} repositoryRoot
 * @property {*} config
 * @property {*} cachedConfig
 * @property {*} globalConfig
 * @property {import('../../utils/state-config.mts').default} state,
 */
/** Base command class that provides tracking and config initialization */
export default class BaseCommand extends Command {
    private analytics: any
    private noBaseOptions: boolean
    private examples: any[]

    constructor(name?: string) {
        super(name);
        /** @type {{ startTime: bigint, payload?: any}} */
        this.analytics = { startTime: process.hrtime.bigint() };
        /** @private */
        this.noBaseOptions = false;
        /** The examples list for the command (used inside doc generation and help page) */
        this.examples = [];
    }
    /**
     * IMPORTANT this function will be called for each command!
     * Don't do anything expensive in there.
     * @param {string} name The command name
     * @returns
     */
    createCommand(name: string) {
        return (new BaseCommand(name)
            // If  --silent or --json flag passed disable logger
            .addOption(new Option('--json', 'Output return values as JSON').hideHelp(true))
            .addOption(new Option('--silent', 'Silence CLI output').hideHelp(true))
            .addOption(new Option('--cwd <cwd>').hideHelp(true))
            .addOption(new Option('-o, --offline').hideHelp(true))
            .addOption(new Option('--auth <token>', 'Cloudpath auth token').hideHelp(true))
            .addOption(new Option('--httpProxy [address]', 'Old, prefer --http-proxy. Proxy server address to route requests through.')
            .default(process.env.HTTP_PROXY || process.env.HTTPS_PROXY)
            .hideHelp(true))
            .addOption(new Option('--httpProxyCertificateFilename [file]', 'Old, prefer --http-proxy-certificate-filename. Certificate file to use when connecting using a proxy server.')
            .default(process.env.PROXY_CERTIFICATE_FILENAME)
            .hideHelp(true))
            .option('--debug', 'Print debugging information')
            .hook('preAction', async (_parentCommand, actionCommand) => {
            debug(`${name}:preAction`)('start');
            this.analytics = { startTime: process.hrtime.bigint() };
            // @ts-ignore cannot type actionCommand as BaseCommand
            await this.init(actionCommand);
            debug(`${name}:preAction`)('end');
        }));
    }
    /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
    noHelpOptions() {
        this.noBaseOptions = true;
        return this;
    }
    /**
     * Set examples for the command
     * @param {string[]} examples
     */
    addExamples(examples: any) {
        this.examples = examples;
        return this;
    }
    /**
     * Overrides the help output of commander with custom styling
     * @returns {import('commander').Help}
     */
    createHelp() {
        const help = super.createHelp();
        help.commandUsage = (command: any) => {
            const term = this.name() === 'cloudpath'
                ? `${HELP_$} ${command.name()} [COMMAND]`
                : `${HELP_$} ${command.parent.name()} ${command.name()} ${command.usage()}`;
            return padLeft(term, HELP_INDENT_WIDTH);
        };
        const getCommands = (command: any) => {
            const parentCommand = this.name() === 'cloudpath' ? command : command.parent;
            return parentCommand.commands.filter((cmd: any) => {
                // eslint-disable-next-line no-underscore-dangle
                if (cmd._hidden)
                    return false;
                // the root command
                if (this.name() === 'cloudpath') {
                    // don't include subcommands on the main page
                    return !cmd.name().includes(':');
                }
                return cmd.name().startsWith(`${command.name()}:`);
            });
        };
        /**
         * override the longestSubcommandTermLength
         * @param {BaseCommand} command
         * @returns {number}
         */
        help.longestSubcommandTermLength = (command) => getCommands(command).reduce((max: any, cmd: any) => Math.max(max, cmd.name().length), 0);
        /**
         * override the longestOptionTermLength to react on hide options flag
         * @param {BaseCommand} command
         * @param {import('commander').Help} helper
         * @returns {number}
         */
        help.longestOptionTermLength = (command: any, helper) => (command.noBaseOptions === false &&
            helper.visibleOptions(command).reduce((max, option) => Math.max(max, helper.optionTerm(option).length), 0)) ||
            0;
        /**
         * override the format help function to style it correctly
         * @param {BaseCommand} command
         * @param {import('commander').Help} helper
         * @returns {string}
         */
        help.formatHelp = (command: any, helper) => {
            const parentCommand = this.name() === 'cloudpath' ? command : command.parent;
            const termWidth = helper.padWidth(command, helper);
            const helpWidth = helper.helpWidth || FALLBACK_HELP_CMD_WIDTH;
            /**
             * formats a term correctly
             * @param {string} term
             * @param {string} [description]
             * @param {boolean} [isCommand]
             * @returns {string}
             */
            const formatItem = (term: any, description: any = undefined, isCommand = false) => {
                const bang = isCommand ? `${HELP_$} ` : '';
                if (description) {
                    const pad = termWidth + HELP_SEPARATOR_WIDTH;
                    const fullText = `${bang}${term.padEnd(pad - (isCommand ? 2 : 0))}${chalk.grey(description)}`;
                    return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad);
                }
                return `${bang}${term}`;
            };
            /** @type {string[]} */
            let output: any[] = [];
            // Description
            const [topDescription, ...commandDescription] = (helper.commandDescription(command) || '').split('\n');
            if (topDescription.length !== 0) {
                output = [...output, topDescription, ''];
            }
            // on the parent help command the version should be displayed
            if (this.name() === 'cloudpath') {
                output = [...output, chalk.bold('VERSION'), formatHelpList([formatItem(USER_AGENT)]), ''];
            }
            // Usage
            output = [...output, chalk.bold('USAGE'), helper.commandUsage(command), ''];
            // Arguments
            const argumentList = helper
                .visibleArguments(command)
                .map((argument) => formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument)));
            if (argumentList.length !== 0) {
                output = [...output, chalk.bold('ARGUMENTS'), formatHelpList(argumentList), ''];
            }
            if (command.noBaseOptions === false) {
                // Options
                const optionList = helper
                    .visibleOptions(command)
                    .sort(sortOptions)
                    .map((option) => formatItem(helper.optionTerm(option), helper.optionDescription(option)));
                if (optionList.length !== 0) {
                    output = [...output, chalk.bold('OPTIONS'), formatHelpList(optionList), ''];
                }
            }
            // Description
            if (commandDescription.length !== 0) {
                output = [...output, chalk.bold('DESCRIPTION'), formatHelpList(commandDescription), ''];
            }
            // Aliases
            // eslint-disable-next-line no-underscore-dangle
            if (command._aliases.length !== 0) {
                // eslint-disable-next-line no-underscore-dangle
                const aliases = command._aliases.map((alias: string) => formatItem(`${parentCommand.name()} ${alias}`, undefined, true));
                output = [...output, chalk.bold('ALIASES'), formatHelpList(aliases), ''];
            }
            if (command.examples.length !== 0) {
                output = [
                    ...output,
                    chalk.bold('EXAMPLES'),
                    formatHelpList(command.examples.map((example: string) => `${HELP_$} ${example}`)),
                    '',
                ];
            }
            const commandList = getCommands(command).map((cmd: any) => formatItem(cmd.name(), helper.subcommandDescription(cmd).split('\n')[0], true));
            if (commandList.length !== 0) {
                output = [...output, chalk.bold('COMMANDS'), formatHelpList(commandList), ''];
            }
            return [...output, ''].join('\n');
        };
        return help;
    }
    /**
     * Will be called on the end of an action to track the metrics
     * @param {*} [error_]
     */
    async onEnd(error_: any = undefined) {
        const { payload, startTime } = this.analytics;
        const duration = getDuration(startTime);
        const status = error_ === undefined ? 'success' : 'error';
        const command = Array.isArray(this.args) ? this.args[0] : this.name();
        debug(`${this.name()}:onEnd`)(`Command: ${command}. Status: ${status}. Duration: ${duration}ms`);
        try {
            await track('command', {
                ...payload,
                command,
                duration,
                status,
            });
        }
        catch { }
        if (error_ !== undefined) {
            error(error_ instanceof Error ? error_ : format(error_), { exit: false });
            exit(1);
        }
    }
    async authenticate(tokenFromFlag: any) {
        const [token] = await getToken(tokenFromFlag);
        if (token) {
            return token;
        }
        return this.expensivelyAuthenticate();
    }
    async expensivelyAuthenticate() {
        const webUI = process.env.AUTHENTICATION_WEB_UI || 'https://accounts.cloudpath.app';
        log(`Logging into your account...`);
        // // Create ticket for auth
        // // @ts-ignore Types from api are wrong and they don't recognize `createTicket`
        // const ticket = await this.snapwise.api.createTicket({
        //   clientId: CLIENT_ID,
        // })
        // Open browser for authentication
        const authLink = `${webUI}/authorize?response_type=ticket&ticket=${"ticket.id"}`;
        log(`Opening ${authLink}`);
        await openBrowser({ url: authLink });
        const accessToken = await pollForToken({
        // api: this.cloudpath.api,
        // ticket,
        });

        // Log success
        log();
        log(`${chalk.greenBright('You are now logged into your account!')}`);
        log();
        log(`Run ${chalk.cyanBright('cloudpath status')} for account details`);
        log();
        log(`To see all available commands run: ${chalk.cyanBright('cloudpath help')}`);
        log();
        return "accessToken";
    }
    setAnalyticsPayload(payload: any) {
        this.analytics = { ...this.analytics, payload };
    }
    /**
     * Initializes the options and parses the configuration needs to be called on start of a command function
     * @param {BaseCommand} actionCommand The command of the action that is run (`this.` gets the parent command)
     * @private
     */
    async init(actionCommand: any) {
        debug(`${actionCommand.name()}:init`)('start');
        const options = actionCommand.opts();
        const cwd = options.cwd || process.cwd();
        // Get site id & build state
        const state = new StateConfig(cwd);

        const [token] = await getToken(options.auth);
        const apiUrlOpts = {
            userAgent: USER_AGENT,
            urlScheme: "https",
            host: "cloudpath.app"
        };
        if (process.env.API_URL) {
            const apiUrl = new URL(process.env.API_URL);
            apiUrlOpts.urlScheme = apiUrl.protocol.slice(0, -1);
            apiUrlOpts.host = apiUrl.host;
        }
        const cachedConfig = await actionCommand.getConfig({ cwd, state, token, ...apiUrlOpts });
        const { buildDir, config, configPath, repositoryRoot, siteInfo } = cachedConfig;
        const normalizedConfig = normalizeConfig(config);
        const agent = await getAgent({
            httpProxy: options.httpProxy,
            certificateFile: options.httpProxyCertificateFilename,
        });
        const apiOpts = { ...apiUrlOpts, agent };
        const globalConfig = await getGlobalConfig();
        actionCommand.cloudpath = {
            // api methods
            api: new Api({
                authorization: {type: AuthorizationType.token, tokenType: AuthorizationTokenType.personal, token: token},
                urlScheme: apiUrlOpts.urlScheme as UrlScheme,
                host: apiUrlOpts.host,
                userAgent: apiOpts.userAgent,
            }).client,
            apiOpts,
            repositoryRoot,
            // current site context
            site: {
                root: buildDir,
                configPath,
                get id() {
                    return state.get('siteId');
                },
                set id(id) {
                    state.set('siteId', id);
                },
            },
            // Site information retrieved using the API
            siteInfo,
            // Configuration from cloudpath.[toml/yml]
            config: normalizedConfig,
            // Used to avoid calling @cloudpath/config again
            cachedConfig,
            // global cli config
            globalConfig,
            // state of current site dir
            state,
        };
        debug(`${this.name()}:init`)('end');
    }
    /**
     * Find and resolve the Cloudpath configuration
     * @param {*} config
     * @returns {ReturnType<import('@cloudpath/config/src/main')>}
     */
    async getConfig(config: any): Promise<any> {
        const options = this.opts();
        const { cwd, host, offline = options.offline, pathPrefix, scheme, state, token } = config;
        try {
            return await resolveConfig({
                config: options.config,
                cwd,
                context: options.context || process.env.CONTEXT || this.getDefaultContext(),
                debug: this.opts().debug,
                siteId: options.siteId || (typeof options.site === 'string' && options.site) || state.get('siteId'),
                token,
                mode: 'cli',
                host,
                pathPrefix,
                scheme,
                offline,
            });
        }
        catch (error_: any) {
            const isUserError = error_.customErrorInfo !== undefined && error_.customErrorInfo.type === 'resolveConfig';
            // If we're failing due to an error thrown by us, it might be because the token we're using is invalid.
            // To account for that, we try to retrieve the config again, this time without a token, to avoid making
            // any API calls.
            //
            // @todo Replace this with a mechanism for calling `resolveConfig` with more granularity (i.e. having
            // the option to say that we don't need API data.)
            if (isUserError && !offline && token) {
                if (this.opts().debug) {
                    error(error_, { exit: false });
                    warn('Failed to resolve config, falling back to offline resolution');
                }
                return this.getConfig({ cwd, offline: true, state, token });
            }
            const message = isUserError ? error_.message : error_.stack;
            console.error(message);
            exit(1);
        }
    }
    /**
     * Returns the context that should be used in case one hasn't been explicitly
     * set. The default context is `dev` most of the time, but some commands may
     * wish to override that.
     *
     * @returns {string}
     */
    getDefaultContext() {
        if (this.name() === 'serve') {
            return 'production';
        }
        return 'dev';
    }
}