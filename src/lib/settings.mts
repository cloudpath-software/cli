import path from 'path';
import envPaths from 'env-paths';
const OSBasedPaths = envPaths('cloudpath', { suffix: '' });
const CLI_HOME = '.cloudpath';
/**
 * get a global path on the os base path
 * @param {string[]} paths
 * @returns {string}
 */
export const getPathInHome = (paths: string[]) => {
    const pathInHome = path.join(OSBasedPaths.config, ...paths);
    return pathInHome;
};
/**
 * get a path inside the project folder
 * @param {string[]} paths
 * @returns {string}
 */
export const getPathInProject = (paths: string[]) => {
    const pathInProject = path.join(CLI_HOME, ...paths);
    return pathInProject;
};