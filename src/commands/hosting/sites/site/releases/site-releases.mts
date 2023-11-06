import {createSiteReleasesListCommand} from "./site-releases-list.mjs";
import {createSiteReleasesCreateCommand} from "./site-releases-create.mjs";

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
export const createSiteReleasesCommand = (program: any) => {
	createSiteReleasesListCommand(program);
	createSiteReleasesCreateCommand(program)
	return program
		.command('hosting:sites:releases')
		.description(`Handle various site release operations`)
		.addExamples(['cloudpath hosting:sites:releases', 'cloudpath hosting:sites:releases:list', 'cloudpath hosting:sites:releases:create'])
		.action(sites);
};