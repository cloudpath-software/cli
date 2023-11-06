import { stat } from 'fs/promises';
import { basename, resolve } from 'path';
import { cwd, env } from 'process';
import { Option } from 'commander';
import { getProperty } from 'dot-prop';
import inquirer from 'inquirer';
import isObject from 'lodash/isObject.js';
import prettyjson from 'prettyjson';
import { getLogMessage } from '../../../lib/log.mjs';
import { startSpinner, stopSpinner } from '../../../lib/spinner.mjs';
import { chalk, error, exit, getToken, log, logJson, DEV, DEVERR, DEV_LOG, warn, } from '../../../utils/command-helpers.mjs';
import { DEFAULT_DEPLOY_TIMEOUT } from '../../../utils/deploy/constants.mjs';
import {uploadNodes} from "../../../utils/bucket/upload-nodes.mjs";

/**
 * g
 * @param {object} config
 * @param {object} config.config
 * @param {import('commander').OptionValues} config.options
 * @param {object} config.site
 * @param {object} config.siteData
 * @returns {Promise<string>}
 */
const getDeployFolder = async ({ config, options, siteData }: any) => {
    let deployFolder;
    if (options.dir) {
        deployFolder = resolve(cwd(), options.dir);
    }
    // } else if (get(config, 'build.publish')) {
    //   // @ts-ignore
    //   deployFolder = resolve(site.root, get(config, "build.publish"))
    // } else if (get(siteData, 'build_settings.dir')) {
    //   // @ts-ignore
    //   deployFolder = resolve(site.root, get(siteData, 'build_settings.dir'))
    // }
    if (!deployFolder) {
        log('Please provide a publish directory (e.g. "public" or "dist" or "."):');
        log(cwd());
        const { promptPath } = await inquirer.prompt([
            {
                type: 'input',
                name: 'promptPath',
                message: 'Publish directory',
                default: '.',
                filter: (input) => resolve(cwd(), input),
            },
        ]);
        deployFolder = promptPath;
    }
    return deployFolder;
};
const validateDeployFolder = async ({ deployFolder }: any) => {
    /** @type {import('fs').Stats} */
    let stats;
    try {
        stats = await stat(deployFolder);
    }
    catch (error_: any) {
        if (error_.code === 'ENOENT') {
            return error(`No such directory ${deployFolder}! Did you forget to run a build?`);
        }
        // Improve the message of permission errors
        if (error_.code === 'EACCES') {
            return error('Permission error when trying to access deploy folder');
        }
        throw error_;
    }
    if (!stats.isDirectory()) {
        return error('Deploy target must be a path to a directory');
    }
    return stats;
};

const validateFolders = async ({ deployFolder }: any) => {
    const deployFolderStat = await validateDeployFolder({ deployFolder });
    return { deployFolderStat };
};
const getUploadFilesFilter = ({ uploadFolder }: any) => {
    // site.root === deployFolder can happen when users run `cloudpath deploy --dir .`
    // in that specific case we don't want to publish the repo node_modules
    // when site.root !== deployFolder the behaviour matches our buildbot
    // const skipNodeModules = site.root === deployFolder
    return (filename: string | undefined) => {
        if (filename == undefined) {
            return false;
        }
        if (filename === uploadFolder) {
            return true;
        }
        const base = basename(filename);
        const skipFile = (base === 'node_modules') || (base.startsWith('.') && base !== '.well-known') || base.startsWith('__MACOSX') ||
            base.includes('/.');
        return !skipFile;
    };
};
const SEC_TO_MILLISEC = 1e3;
// 100 bytes
const SYNC_FILE_LIMIT = 1e2;
const prepareProductionDeploy = async ({ api, siteData }: any) => {
    if (isObject(siteData.published_deploy) && siteData.published_deploy.locked) {
        log(`\n${DEVERR} Deployments are "locked" for production context of this site\n`);
        const { unlockChoice } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'unlockChoice',
                message: 'Would you like to "unlock" deployments for production context to proceed?',
                default: false,
            },
        ]);
        if (!unlockChoice)
            exit(0);
        await api.unlockDeploy({ deploy_id: siteData.published_deploy.id });
        log(`\n${DEV_LOG} "Auto publishing" has been enabled for production context\n`);
    }
    log('Deploying to main site URL...');
};
const hasErrorMessage = (actual: any, expected: any) => {
    if (typeof actual === 'string') {
        return actual.includes(expected);
    }
    return false;
};
const getJsonErrorMessage = (error_: any) => getProperty(error_, 'json.message', '');
const reportDeployError = ({ error_, failAndExit }: any) => {
    switch (true) {
        case error_.name === 'JSONHTTPError': {
            const message = getJsonErrorMessage(error);
            if (hasErrorMessage(message, 'Background Functions not allowed by team plan')) {
                return failAndExit(`\n${getLogMessage('functions.backgroundNotSupported')}`);
            }
            warn(`JSONHTTPError: ${message} ${error_.status}`);
            warn(`\n${JSON.stringify(error_, null, '  ')}\n`);
            failAndExit(error_);
            return;
        }
        case error_.name === 'TextHTTPError': {
            warn(`TextHTTPError: ${error_.status}`);
            warn(`\n${error_}\n`);
            failAndExit(error_);
            return;
        }
        case hasErrorMessage(error_.message, 'Invalid filename'): {
            warn(error_.message);
            failAndExit(error_);
            return;
        }
        default: {
            warn(`\n${JSON.stringify(error_, null, '  ')}\n`);
            failAndExit(error_);
        }
    }
};
const deployProgressCb = function () {
    /**
     * @type {Record<string, import('ora').Ora>}
     */
    const events: any = {};
    return (event: any) => {
        switch (event.phase) {
            case 'start': {
                events[event.type] = startSpinner({
                    text: event.msg,
                });
                return;
            }
            case 'progress': {
                const spinner = events[event.type];
                if (spinner) {
                    spinner.text = event.msg;
                }
                return;
            }
            case 'error':
                stopSpinner({ error: true, spinner: events[event.type], text: event.msg });
                delete events[event.type];
                return;
            case 'stop':
            default: {
                stopSpinner({ spinner: events[event.type], text: event.msg });
                delete events[event.type];
            }
        }
    };
};
const runUpload = async ({ api, configPath, uploadFolder, deployTimeout, silent, bucketId, folderId }: any) => {
    let results: any;
    let deployId;
    try {
        // results = await api.createSiteDeploy({ siteId, title, body: { draft, branch: alias } })
        // deployId = results.id
        // @ts-ignore
        results = await uploadNodes(api, bucketId, uploadFolder, {
            configPath,
            folderId,
            statusCb: silent ? () => { } : deployProgressCb(),
            deployTimeout,
            syncFileLimit: SYNC_FILE_LIMIT,
            // pass an existing deployId to update
            filter: getUploadFilesFilter({ uploadFolder }),
        });
    }
    catch (error_) {
        if (deployId) {
            // await cancelDeploy({ api, deployId })
        }
        reportDeployError({ error_, failAndExit: error });
    }
    // const siteUrl = results.deploy.ssl_url || results.deploy.url
    const deployUrl = getProperty(results, 'deploy.deploy_ssl_url') || getProperty(results, "deploy.deployUrl");
    const logsUrl = `${getProperty(results, 'deploy.admin_url')}/deploys/${getProperty(results, 'deploy.id')}`;
    return {
        // siteId: results.deploy.site_id,
        siteName: results.deploy.name,
        deployId: results.deployId,
        // siteUrl,
        deployUrl,
        logsUrl,
    };
};

/**
 *
 * @param {object} config
 * @param {boolean} config.deployToProduction
 * @param {boolean} config.json If the result should be printed as json message
 * @param {boolean} config.runBuildCommand If the build command should be run
 * @param {object} config.results
 * @returns {void}
 */
const printResults = ({ deployToProduction, json, results, runBuildCommand }: any) => {
    const msgData: any = {
        Logs: `${results.logsUrl}`,
        'Unique Deploy URL': results.deployUrl,
    };
    if (deployToProduction) {
        msgData['Website URL'] = results.siteUrl;
    }
    else {
        delete msgData['Unique Deploy URL'];
        msgData['Website Draft URL'] = results.deployUrl;
    }
    // Spacer
    log();
    // Json response for piping commands
    if (json) {
        const jsonData: any = {
            name: results.name,
            site_id: results.site_id,
            site_name: results.siteName,
            deploy_id: results.deployId,
            deploy_url: results.deployUrl,
            logs: results.logsUrl,
        };
        if (deployToProduction) {
            jsonData.url = results.siteUrl;
        }
        logJson(jsonData);
        exit(0);
    }
    else {
        log(prettyjson.render(msgData));
        if (!deployToProduction) {
            log();
            log('If everything looks good on your draft URL, deploy it to your main site URL with the --prod flag.');
            log(`${chalk.cyanBright.bold(`cloudpath deploy${runBuildCommand ? ' --build' : ''} --prod`)}`);
            log();
        }
    }
};
/**
 * The deploy command
 * @param {import('commander').OptionValues} options
 * @param {import('../../base-command.mjs').default} command
 */
const upload = async (options: any, command: any) => {
    const { api, site } = command.cloudpath;
    const alias = options.alias || options.branch;
    if (!options.bucket) {
        return error('--bucket flag required');
    }
    if (!options.dir) {
        return error('--dir flag is required');
    }
    // await command.authenticate(options.auth)
    let bucketId = options.bucket as string;
    let siteData: any = {};

    // const { configMutations = [], newConfig } = await handleBuild({
    //   // cachedConfig: command.cloudpath.cachedConfig,
    //   options,
    // })
    // const config = newConfig || command.cloudpath.config
    const config = {};
    const uploadFolder = await getDeployFolder({ options, config, siteData });
    // const { configPath } = site



    log(prettyjson.render({
        'Deploy path': uploadFolder,
        'Configuration path': "configPath",
    }));

    const results = await runUpload({
        api,
        // configPath,
        uploadFolder,
        deployTimeout: options.timeout * SEC_TO_MILLISEC || DEFAULT_DEPLOY_TIMEOUT,
        silent: options.silent,
        bucketId,
        folderId: options.folder
    });

    printResults({
        // results,
    });

    exit();
};
/**
 * Creates the `cloudpath deploy` command
 * @param {import('../../base-command.mjs').default} program
 * @returns
 */
export const createUploadCommand = (program: any) => program
    .command('cdn:upload')
    .description(`Upload files to a bucket directory
Uploads from the build settings found in the cloudpath.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- \`AUTH_TOKEN\` - an access token to use when authenticating commands. Keep this value private.
- \`BUCKET_ID\` - override any linked bucket in the current working directory.
- \`$BUCKET_FOLDER_ID\` - override any linked bucket folder in the current working directory.`)
    .option('-d, --dir <path>', 'Specify a folder with files to upload')
    .option('-a, --auth <token>', 'cloudpath auth token to deploy with', env.AUTH_TOKEN)
    .option('-s, --bucket <id>', 'A bucket ID to upload to', env.BUCKET_ID)
    .option('-s, --folder <id>', 'A bucket directory ID to upload to', env.BUCKET_FOLDER_ID)
    .addExamples([
    'cloudpath cdn:upload',
    'cloudpath cdn:upload --dir images',
    'cloudpath cdn:upload --bucket $BUCKET_ID',
    'cloudpath cdn:upload --folder $BUCKET_FOLDER_ID',
    'cloudpath cdn:upload --auth $AUTH_TOKEN',
])
    .action(upload);