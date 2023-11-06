/**
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const buckets = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath release:applications:distribution-groups` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createApplicationsDistributionGroupsCommand = (program: any) => {
    return program
        .command('release:applications:distribution-groups')
        .description(`Manage release application's distribution groups`)
        .addExamples(['cloudpath release:applications:distribution-groups:list'])
        .action(buckets);
};