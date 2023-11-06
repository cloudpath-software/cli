import { RestClient } from '@cloudpath/js-api';
import { startSpinner, stopSpinner } from '../../../lib/spinner.mjs';
import { chalk, log, logJson } from '../../../utils/command-helpers.mjs';
import {Site} from "@cloudpath/shared-models";
/**
 * The sites:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 * @returns {Promise<{ id: any; name: any; ssl_url: any; account_name: any; }|boolean>}
 */
const sitesList = async (options: any, command: any) => {
    const api = command.cloudpath.api as RestClient
    /** @type {import('ora').Ora} */
    let spinner;
    if (!options.json) {
        spinner = startSpinner({ text: 'Loading your sites' });
    }
    await command.authenticate(options.auth);
    const {data} = await api.hosting.sites.retrieveAll({page: 0, size: 20})

    if (!options.json) {
        stopSpinner({ spinner });
    }
    if (data && data.length !== 0) {
        const logSites: Site[] = data.map((site) => {
            const siteInfo: any = {
                id: site.id,
                name: site.name,
                ssl_url: site.url,
                account_name: site.name,
            };
            // if (site.build_settings && site.build_settings.repo_url) {
            //     siteInfo.repo_url = site.build_settings.repo_url;
            // }
            return siteInfo;
        });
        // Json response for piping commands
        if (options.json) {
            const redactedSites = data.map((site: any) => {
                // if (site && site.build_settings) {
                //     delete site.build_settings.env;
                // }
                return site;
            });
            logJson(redactedSites);
            return false;
        }
        log(`
────────────────────────────┐
 Current Cloudpath Sites    │
────────────────────────────┘

Count: ${logSites.length}
`);
        logSites.forEach((logSite) => {
            log(`${chalk.greenBright(logSite.name)} - ${logSite.id}`);
            log(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(logSite.url)}`);
            log(`─────────────────────────────────────────────────`);
        });
    }
    return
};
/**
 * Creates the `cloudpath hosting:sites:list` command
 * @param {import('../../base-command.mjs').default} program
 */
export const createSitesListCommand = (program: any) => program
    .command('hosting:sites:list')
    .description('List all sites you have access to')
    .option('--json', 'Output site data as JSON')
    .action(async (options: any, command: any) => {
    await sitesList(options, command);
});