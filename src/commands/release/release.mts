import {createApplicationsCommand} from "./applications/applications.mjs";

/**
 * The release command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const release = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath release` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createReleasesCommand = (program: any) => {
    createApplicationsCommand(program)
    return program
        .command('release')
        .description(`Handle various release operations`)
        .action(release);
};
