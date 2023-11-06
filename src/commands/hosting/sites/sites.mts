import { createSitesCreateCommand } from './sites-create.mjs';
import { createSitesDeleteCommand } from './site/sites-delete.mjs';
import { createSitesListCommand } from './sites-list.mjs';
import {createSiteReleasesCommand} from "./site/releases/site-releases.mjs";
/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const sites = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath sites` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createSitesCommand = (program: any) => {
    createSitesCreateCommand(program);
    createSitesListCommand(program);
    createSitesDeleteCommand(program);
    createSiteReleasesCommand(program)

    return program
        .command('hosting:sites')
        .description(`Handle various site operations\nThe sites command will help you manage all your sites`)
        .addExamples(['cloudpath sites:create --name my-new-site', 'cloudpath sites:list'])
        .action(sites);
};