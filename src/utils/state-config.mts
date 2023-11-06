import fs from 'fs';
import path from 'path';
import process from 'process';
import { getProperty, setProperty, hasProperty, deleteProperty } from 'dot-prop';
import { findUpSync } from 'find-up';
import writeFileAtomic from 'write-file-atomic';
import { getPathInProject } from '../lib/settings.mjs';
const STATE_PATH = getPathInProject(['state.json']);
const permissionError = "You don't have access to this file.";
// Finds location of `.cloudpath/state.json`
const findStatePath = (cwd: any) => {
    const statePath = findUpSync([STATE_PATH], { cwd });
    if (!statePath) {
        return path.join(cwd, STATE_PATH);
    }
    return statePath;
};
export default class StateConfig {

    private readonly path: string

    constructor(cwd: any) {
        this.path = findStatePath(cwd);
    }
    get all() {
        try {
            return JSON.parse(fs.readFileSync(this.path).toString("utf8"));
        }
        catch (error: any) {
            // Don't create if it doesn't exist
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
                return {};
            }
            // Improve the message of permission errors
            if (error.code === 'EACCES') {
                error.message = `${error.message}\n${permissionError}\n`;
            }
            // Empty the file if it encounters invalid JSON
            if (error.name === 'SyntaxError') {
                writeFileAtomic.sync(this.path, '');
                return {};
            }
            throw error;
        }
    }
    set all(val) {
        try {
            // Make sure the folder exists as it could have been deleted in the meantime
            fs.mkdirSync(path.dirname(this.path), { recursive: true });
            writeFileAtomic.sync(this.path, JSON.stringify(val, null, '\t'));
        }
        catch (error: any) {
            // Improve the message of permission errors
            if (error.code === 'EACCES') {
                error.message = `${error.message}\n${permissionError}\n`;
            }
            throw error;
        }
    }
    get size() {
        return Object.keys(this.all || {}).length;
    }
    get(key: string) {
        if (key === 'siteId' && process.env.SITE_ID) {
            // TODO figure out cleaner way of grabbing ENV vars
            return process.env.SITE_ID;
        }
        return getProperty(this.all, key);
    }
    set(...args: any[]) {
        const [key, val] = args;
        const config = this.all;
        if (args.length === 1) {
            Object.entries(key).forEach(([keyPart, value]) => {
                setProperty(config, keyPart, value);
            });
        }
        else {
            setProperty(config, key, val);
        }
        this.all = config;
    }
    has(key: string) {
        return hasProperty(this.all, key);
    }
    delete(key: string) {
        const config = this.all;
        deleteProperty(config, key);
        this.all = config;
    }
    clear() {
        this.all = {};
    }
}