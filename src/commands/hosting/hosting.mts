import { createSitesCommand } from "./sites/index.mjs";
import { createDeployCommand } from "./deploy/index.mjs";
/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const hosting = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath sites` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createHostingCommand = (program: any) => {
    createDeployCommand(program);
    createSitesCommand(program);
    return program
        .command('hosting')
        .description(`Handle various cloud hosting operations`)
        .addExamples([
        'cloudpath hosting',
        'cloudpath hosting:sites',
        'cloudpath hosting:deploy',
    ])
        .action(hosting);
};