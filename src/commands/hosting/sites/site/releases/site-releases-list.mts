import inquirer from 'inquirer';
import { chalk, error, exit, log } from '../../../../../utils/command-helpers.mjs';
/**
 * The sites:delete command
 * @param {string} siteId
 * @param {import('commander').OptionValues} options
 * @param {import('../../../base-command.mjs').default} command
 */
const siteReleasesList = async (options: any, command: any) => {
    command.setAnalyticsPayload({ force: options.force });
    const { api } = command.cloudpath;
    // const cwdSiteId = site.id;
    // 1. Prompt user for verification
    await command.authenticate(options.auth);
    let siteData;
    try {
        // siteData = await api.getSite({ siteId });
    }
    catch (error_ : any) {
        if (error_.status === 404) {
            // error(`No site with id ${siteId} found. Please verify the siteId & try again.`);
        }
    }

    log(`Site "" successfully deleted!`);
};
/**
 * Creates the `cloudpath sites:releases:list` command
 * @param {import('../../../base-command.mjs').default} program
 * @returns
 */
export const createSiteReleasesListCommand = (program: any) => program
    .command('hosting:sites:releases:list')
    .description('List all site releases.')
    .addExamples(['cloudpath hosting:sites:releases:list 1234-3262-1211'])
    .action(siteReleasesList);