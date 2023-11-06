import inquirer from 'inquirer';
import {chalk, error, exit, log} from '../../../../../utils/command-helpers.mjs';
import {RestClient} from '@cloudpath/js-api';
import {startSpinner, stopSpinner} from "../../../../../lib/spinner.mjs";
import cliProgress from "cli-progress";
import {Blob, File} from "buffer";
import { ReleaseArchiveUploadStatus } from '@cloudpath/shared-models';

/**
 * The hosting:sites:releases:create command
 * @param {import('commander').OptionValues} options
 * @param {import('../../../base-command.mjs').default} command
 */
const createSiteReleasesCreate = async (options: any, command: any) => {
	command.setAnalyticsPayload({force: options.force});
	const api = command.cloudpath.api as RestClient;
	// 1. Prompt user for verification
	await command.authenticate(options.auth);

	let siteId = options.site
	if (!options.site) {
		let spinner = startSpinner({text: `Loading your sites`});

		const {data} = await api.hosting.sites.retrieveAll({page: 0, size: 20})

		stopSpinner({spinner});

		if (data && data.length === 0) {
			error(`No sites were returned.`);
		}

		const {siteId: selectedSiteId} = await inquirer.prompt([
			{
				type: 'list',
				name: 'siteId',
				message: 'Sites:',
				choices: data.map((site) => ({
					value: site.id,
					name: site.name,
				})),
			},
		]);

		siteId = selectedSiteId
	}

	let deployId = options.deploy
	if (!options.deploy) {
		let spinner = startSpinner({text: `Loading deploys for site id ${siteId}`});

		const {data} = await api.hosting.sites.id(siteId).deploys.retrieveAll({page: 0, size: 20})

		stopSpinner({spinner});

		if (data && data.length === 0) {
			error(`The site with id ${siteId} has no deploys.`);
		}

		const {siteDeployId: selectedSiteDeploy} = await inquirer.prompt([
			{
				type: 'list',
				name: 'siteDeployId',
				message: 'Site deploys:',
				choices: data.map((siteDeploy) => ({
					value: siteDeploy.id,
					name: siteDeploy.id,
				})),
			},
		]);

		deployId = selectedSiteDeploy
	}

	const RELEASE_TRACK_PROMPT = 'Release track';
	const DISTRIBUTION_GROUP_PROMPT = 'Distribution group';

	const {releaseType} = await inquirer.prompt([
		{
			type: 'list',
			name: 'releaseType',
			message: 'Which release path do you want to take?',
			choices: [RELEASE_TRACK_PROMPT, DISTRIBUTION_GROUP_PROMPT],
		},
	]);

	const releaseApplicationId = await api.hosting.sites.id(siteId).releases.retrieveApplicationId()

	switch (releaseType) {
		case RELEASE_TRACK_PROMPT: {
			let loadReleaseTracksSpinner = startSpinner({text: `Loading release tracks for application id ${releaseApplicationId}`});

			const {data: releaseTracks} = await api.release.applications.id(releaseApplicationId).releaseTracks.retrieveAll()

			stopSpinner({spinner: loadReleaseTracksSpinner});

			if (releaseTracks && releaseTracks.length === 0) {
				error(`The release application with id ${releaseApplicationId} has no release tracks.`);
			}

			const {releaseTrackId: selectedReleaseTrackId} = await inquirer.prompt([
				{
					type: 'list',
					name: 'releaseTrackId',
					message: 'Which release track do you want to create a release for ?',
					choices: releaseTracks.map((releaseTrack) => ({
						value: releaseTrack.id,
						name: releaseTrack.name,
					})),
				},
			]);


			const {version} = await inquirer.prompt([
				{
					type: 'input',
					name: 'version',
					message: 'New version:'
				},
			]);

			const {notes} = await inquirer.prompt([
				{
					type: 'input',
					name: 'notes',
					message: 'Release notes:'
				},
			]);

			let createReleaseSpinner = startSpinner({text: `Creating release`});

			const {data: createdReleaseResponse} = await api.release
				.applications.id(releaseApplicationId)
				.releaseTracks.id(selectedReleaseTrackId)
				.createRelease({version: version, notes: notes})

			stopSpinner({spinner: createReleaseSpinner});

			let fetchZippedFilesSpinner = startSpinner({text: `Retrieving zipped files for deploy id ${deployId}`});

			const deployFilesZip = await api.hosting.deploys.id(deployId).retrieveDeployFilesZip()

			stopSpinner({spinner: fetchZippedFilesSpinner});

			const {data: patchFileMetadataResponse} = await api.cdn
				.nodes.id(createdReleaseResponse.packageAssetId)
				.upload().setFileUploadMetaData({name: "", fileSizeBytes: deployFilesZip.size, appType: "application/zip"})

			await api.release
				.applications.id(releaseApplicationId)
				.releases.id(createdReleaseResponse.id)
				.patchReleaseUploadStatus({status: ReleaseArchiveUploadStatus.UPLOADING})

			// create a new progress bar instance and use shades_classic theme
			const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

			let uploadProgressValue = 0
			bar1.start(deployFilesZip.size, uploadProgressValue);

			const chunkSize = patchFileMetadataResponse.chunkSize;

			let remainingDataToUpload = deployFilesZip
			while(remainingDataToUpload.size !== 0) {
				let sliceEnd: number

				if(remainingDataToUpload.size - 1 >= chunkSize) {
					sliceEnd = chunkSize
				} else {
					sliceEnd = remainingDataToUpload.size
				}

				const chunkToUpload = remainingDataToUpload.slice(0, sliceEnd);

				uploadProgressValue += chunkToUpload.size

				const blob = new Blob([chunkToUpload])

				await api.cdn
					.nodes.id(createdReleaseResponse.packageAssetId)
					.upload().uploadChunk(blob, (e) => {
						// console.log(`progress event -> ${e.progress} ${e.rate}`)
					})

				bar1.update(uploadProgressValue);

				remainingDataToUpload = remainingDataToUpload.slice(sliceEnd, remainingDataToUpload.size)
			}

			bar1.stop();

			await api.release
				.applications.id(releaseApplicationId)
				.releases.id(createdReleaseResponse.id)
				.patchReleaseUploadStatus({status: ReleaseArchiveUploadStatus.UPLOADED})

			let { active } = options;
			if (!active) {
				const { active: setAsLatestRelease } = await inquirer.prompt([
					{
						type: 'confirm',
						name: 'active',
						message: 'Set as latest release version?',
					},
				]);
				active = setAsLatestRelease;
			}

			if(active) {
				await api.release
					.applications.id(releaseApplicationId)
					.releaseTracks.id(selectedReleaseTrackId)
					.updateActiveRelease({releaseId: createdReleaseResponse.id})
			}

			break
		}
		case DISTRIBUTION_GROUP_PROMPT: {
			let spinner = startSpinner({text: `Loading distribution groups for application id ${releaseApplicationId}`});

			const {data} = await api.release.applications.id(releaseApplicationId).distributionGroups.retrieveAll()

			stopSpinner({spinner});

			if (data && data.length === 0) {
				error(`The release application with id ${releaseApplicationId} has no distribution groups.`);
			}

			const {distributionGroupId: selectedDistributionGroup} = await inquirer.prompt([
				{
					type: 'list',
					name: 'distributionGroupId',
					message: 'Available distribution groups:',
					choices: data.map((releaseTrack) => ({
						value: releaseTrack.id,
						name: releaseTrack.name,
					})),
				},
			]);

			log(`Selected distribution group id ${selectedDistributionGroup}`)

			break
		}
	}

	log(`Release "${siteId}" successfully created!`);
};
/**
 * Creates the `cloudpath hosting:sites:releases:create` command
 * @param {import('../../../base-command.mjs').default} program
 * @returns
 */
export const createSiteReleasesCreateCommand = (program: any) => program
	.command('hosting:sites:releases:create')
	.description('Create a new site release by release track or distribution group.')
	.option('-s, --site <siteId>', 'Site id')
	.option('--deploy <deployId>', 'Site deploy id selected for the release')
	.option('-a, --active', 'Set release as active & notifies users an update is available')
	.option('--notify-testers', 'Only applied for a distribution group release. Testers will receive an email notifying them of an update.', false)
	.addExamples(['cloudpath hosting:sites:releases:create --site 1234-3262-1211', 'cloudpath hosting:sites:releases:create --site 1234-3262-1211 --deploy 1234-3262-1211'])
	.action(createSiteReleasesCreate);