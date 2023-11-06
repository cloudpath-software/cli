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
export const createBucketsCommand = (program: any) => {
    return program
        .command('cdn:buckets')
        .description(`Handle various bucket operations\nThe sites command will help you manage all your buckets (work in progress, not functional yet)`)
        .addExamples(['cloudpath cdn:buckets:list'])
        .action(buckets);
};