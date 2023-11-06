import {createApplicationsDistributionGroupsCommand} from "./distributiongroups/applications-distribution-groups.mjs";
import {createApplicationsReleaseTracksCommand} from "./tracks/applications-release-tracks.mjs";

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const buckets = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath sites` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createApplicationsCommand = (program: any) => {
    createApplicationsDistributionGroupsCommand(program);
    createApplicationsReleaseTracksCommand(program);
    return program
        .command('release:applications')
        .description(`Manage release applications`)
        .addExamples(['cloudpath release:applications:list'])
        .action(buckets);
};