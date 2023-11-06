import { InvalidArgumentError } from 'commander';
import inquirer from 'inquirer';
import pick from 'lodash/pick.js';
import prettyjson from 'prettyjson';
import { chalk, error, log, logJson, warn } from '../../../utils/command-helpers.mjs';
import getRepoData from '../../../utils/get-repo-data.mjs';
import { track } from '../../../utils/telemetry/index.mjs';
import { RestClient } from '@cloudpath/js-api';
export const getSiteNameInput = async (name?: string) => {
    if (!name) {
        const { name: nameInput } = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Site name (leave blank for a random name; you can change it later):',
                validate: (input) => /^[a-zA-Z\d-]+$/.test(input || undefined) || 'Only alphanumeric characters and hyphens are allowed',
            },
        ]);
        name = nameInput || '';
    }
    return { name };
};
/**
 * The sites:create command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
export const sitesCreate = async (options: any, command: any) => {
    const api = command.cloudpath.api as any;
    await command.authenticate();
    const accounts = await api.listAccountsForUser();
    let { accountSlug } = options;
    if (!accountSlug) {
        const { accountSlug: accountSlugInput } = await inquirer.prompt([
            {
                type: 'list',
                name: 'accountSlug',
                message: 'Team:',
                choices: accounts.map((account: any) => ({
                    value: account.slug,
                    name: account.name,
                })),
            },
        ]);
        accountSlug = accountSlugInput;
    }
    let site: any;
    // Allow the user to reenter site name if selected one isn't available
    const inputSiteName = async (name: string | undefined = undefined) => {
        const { name: siteName }: any = await getSiteNameInput(name);
        const body: any = {};
        if (typeof siteName === 'string') {
            body.name = siteName.trim();
        }
        try {
            site = await api.createSiteInTeam({
                accountSlug,
                body,
            });
        }
        catch (error_: any) {
            if (error_.status === 422) {
                warn(`${siteName}.cloudpath.app already exists. Please try a different slug.`);
                await inputSiteName();
            }
            else {
                error(`createSiteInTeam error: ${error_.status}: ${error_.message}`);
            }
        }
    };
    await inputSiteName(options.name);
    log();
    log(chalk.greenBright.bold.underline(`Site Created`));
    log();
    const siteUrl = site.ssl_url || site.url;
    log(prettyjson.render({
        'Admin URL': site.admin_url,
        URL: siteUrl,
        'Site ID': site.id,
    }));
    track('sites_created', {
        siteId: site.id,
        adminUrl: site.admin_url,
        siteUrl,
    });
    if (options.json) {
        logJson(pick(site, [
            'id',
            'state',
            'plan',
            'name',
            'custom_domain',
            'domain_aliases',
            'url',
            'ssl_url',
            'admin_url',
            'screenshot_url',
            'created_at',
            'updated_at',
            'user_id',
            'ssl',
            'force_ssl',
            'managed_dns',
            'deploy_url',
            'account_name',
            'account_slug',
            'git_provider',
            'deploy_hook',
            'capabilities',
            'id_domain',
        ]));
    }
    if (!options.disableLinking) {
        log();
        // await link({ id: site.id }, command);
    }
    return site;
};
const MAX_SITE_NAME_LENGTH = 63;
const validateName = function (value: any) {
    // cloudpath sites:create --name <A string of more than 63 words>
    if (typeof value === 'string' && value.length > MAX_SITE_NAME_LENGTH) {
        throw new InvalidArgumentError(`--name should be less than 64 characters, input length: ${value.length}`);
    }
    return value;
};
/**
 * Creates the `cloudpath hosting:sites:create` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createSitesCreateCommand = (program: any) => program
    .command('hosting:sites:create')
    .description(`Create an empty site (advanced)
Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`)
    .option('-n, --name <name>', 'name of site', validateName)
    .option('-a, --account-slug <slug>', 'account slug to create the site under')
    .option('-c, --with-ci', 'initialize CI hooks during site creation')
    .option('-m, --manual', 'force manual CI setup.  Used --with-ci flag')
    .option('--disable-linking', 'create the site without linking it to current directory')
    .addHelpText('after', `Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`)
    .action(sitesCreate);