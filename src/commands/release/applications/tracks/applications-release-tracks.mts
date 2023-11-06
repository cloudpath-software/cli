/**
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const buckets = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath release:applications:release-tracks` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createApplicationsReleaseTracksCommand = (program: any) => {
    return program
        .command('release:applications:release-tracks')
        .description(`Manage release application's release tracks`)
        .addExamples(['cloudpath release:applications:release-tracks:create'])
        .action(buckets);
};