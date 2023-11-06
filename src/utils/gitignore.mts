import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import parseIgnore from 'parse-gitignore';
import { fileExistsAsync } from '../lib/fs.mjs';
import { log } from './command-helpers.mjs';
const hasGitIgnore = async function (dir: any) {
    const gitIgnorePath = path.join(dir, '.gitignore');
    const hasIgnore = await fileExistsAsync(gitIgnorePath);
    return hasIgnore;
};
export const ensureCloudpathIgnore = async function (dir: any) {
    const gitIgnorePath = path.join(dir, '.gitignore');
    const ignoreContent = '# Local Cloudpath folder\n.cloudpath\n';
    /* No .gitignore file. Create one and ignore .cloudpath folder */
    if (!(await hasGitIgnore(dir))) {
        await writeFile(gitIgnorePath, ignoreContent, 'utf8');
        return false;
    }
    let gitIgnoreContents;
    let ignorePatterns;
    try {
        gitIgnoreContents = await readFile(gitIgnorePath, 'utf8');
        ignorePatterns = parseIgnore.parse(gitIgnoreContents);
    }
    catch {
        // ignore
    }
    /* Not ignoring .cloudpath folder. Add to .gitignore */
    if (!ignorePatterns || !ignorePatterns.patterns.some((pattern: string) => /(^|\/|\\)\.cloudpath($|\/|\\)/.test(pattern))) {
        log();
        log('Adding local .cloudpath folder to .gitignore file...');
        const newContents = `${gitIgnoreContents}\n${ignoreContent}`;
        await writeFile(gitIgnorePath, newContents, 'utf8');
    }

    return;
};