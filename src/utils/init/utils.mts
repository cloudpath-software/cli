import path from 'path';
import process from 'process';
import inquirer from 'inquirer';
import { normalizeBackslash } from '../../lib/path.mjs';
import { chalk, error as failAndExit, log, warn } from '../command-helpers.mjs';
import { getFrameworkInfo } from './frameworks.mjs';
import { detectNodeVersion } from './node-version.mjs';
import { getRecommendPlugins, getUIPlugins } from './plugins.mjs';
const normalizeDir = ({ baseDirectory, defaultValue, dir }: any) => {
    if (dir === undefined) {
        return defaultValue;
    }
    const relativeDir = path.relative(baseDirectory, dir);
    return relativeDir || defaultValue;
};
const getDefaultBase = ({ baseDirectory, repositoryRoot }: any) => {
    if (baseDirectory !== repositoryRoot && baseDirectory.startsWith(repositoryRoot)) {
        return path.relative(repositoryRoot, baseDirectory);
    }
    return
};
const getDefaultSettings = ({ baseDirectory, config, frameworkBuildCommand, frameworkBuildDir, frameworkPlugins, repositoryRoot, }: any) => {
    const recommendedPlugins = getRecommendPlugins(frameworkPlugins, config);
    const { command: defaultBuildCmd = frameworkBuildCommand, functions: defaultFunctionsDir, publish: defaultBuildDir = frameworkBuildDir, } = config.build;
    return {
        defaultBaseDir: getDefaultBase({ repositoryRoot, baseDirectory }),
        defaultBuildCmd,
        defaultBuildDir: normalizeDir({ baseDirectory, dir: defaultBuildDir, defaultValue: '.' }),
        recommendedPlugins,
    };
};
const getPromptInputs = ({ defaultBaseDir, defaultBuildCmd, defaultBuildDir }: any) => {
    const inputs = [
        defaultBaseDir !== undefined && {
            type: 'input',
            name: 'baseDir',
            message: 'Base directory (e.g. projects/frontend):',
            default: defaultBaseDir,
        },
        {
            type: 'input',
            name: 'buildCmd',
            message: 'Your build command (hugo build/yarn run build/etc):',
            filter: (val: string) => (val === '' ? '# no build command' : val),
            default: defaultBuildCmd,
        },
        {
            type: 'input',
            name: 'buildDir',
            message: 'Directory to deploy (blank for current dir):',
            default: defaultBuildDir,
        },
    ].filter(Boolean);
    return inputs.filter(Boolean);
};
// `repositoryRoot === siteRoot` means the base directory wasn't detected by @cloudpath/config, so we use cwd()
const getBaseDirectory = ({ repositoryRoot, siteRoot }: any) => path.normalize(repositoryRoot) === path.normalize(siteRoot) ? process.cwd() : siteRoot;
export const getBuildSettings = async ({ config, env, repositoryRoot, siteRoot }: any) => {
    const baseDirectory = getBaseDirectory({ repositoryRoot, siteRoot });
    const nodeVersion = await detectNodeVersion({ baseDirectory, env });
    const { frameworkBuildCommand, frameworkBuildDir, frameworkName, frameworkPlugins = [], } = await getFrameworkInfo({
        baseDirectory,
        nodeVersion,
    });
    const { defaultBaseDir, defaultBuildCmd, defaultBuildDir, recommendedPlugins } = await getDefaultSettings({
        repositoryRoot,
        config,
        baseDirectory,
        frameworkBuildCommand,
        frameworkBuildDir,
        frameworkPlugins,
    });
    if (recommendedPlugins.length !== 0) {
        log(`Configuring ${formatTitle(frameworkName)} runtime...`);
        log();
    }
    const { baseDir, buildCmd, buildDir } = await inquirer.prompt(getPromptInputs({
        defaultBaseDir,
        defaultBuildCmd,
        defaultBuildDir,
    }));
    const pluginsToInstall = recommendedPlugins.map((plugin: any) => ({ package: plugin }));
    const normalizedBaseDir = baseDir ? normalizeBackslash(baseDir) : undefined;
    return { baseDir: normalizedBaseDir, buildCmd, buildDir, pluginsToInstall };
};

export const formatErrorMessage = ({ error, message }: any) => {
    const errorMessage = error.json ? `${error.message} - ${JSON.stringify(error.json)}` : error.message;
    return `${message} with error: ${chalk.red(errorMessage)}`;
};
const formatTitle = (title?: string) => chalk.cyan(title);
export const createDeployKey = async ({ api }: any) => {
    try {
        const deployKey = await api.createDeployKey();
        return deployKey;
    }
    catch (error) {
        const message = formatErrorMessage({ message: 'Failed creating deploy key', error });
        failAndExit(message);
    }
};
export const updateSite = async ({ api, options, siteId }: any) => {
    try {
        const updatedSite = await api.updateSite({ siteId, body: options });
        return updatedSite;
    }
    catch (error) {
        const message = formatErrorMessage({ message: 'Failed updating site with repo information', error });
        failAndExit(message);
    }
};
export const setupSite = async ({ api, configPlugins, pluginsToInstall, repo, siteId }: any) => {
    const updatedSite = await updateSite({
        siteId,
        api,
        // merge existing plugins with new ones
        options: { repo, plugins: [...getUIPlugins(configPlugins), ...pluginsToInstall] },
    });
    return updatedSite;
};