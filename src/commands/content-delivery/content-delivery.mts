import { createBucketsCommand } from './buckets/index.mjs'
import { createUploadCommand } from './upload/index.mjs'
/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const cdn = (options: any, command: any) => {
    command.help();
};
/**
 * Creates the `cloudpath sites` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createContentDeliveryCommand = (program: any) => {
	createBucketsCommand(program)
	createUploadCommand(program)
    return program
        .command('cdn')
        .description(`Handle various content-delivery operations`)
        .action(cdn);
};
