import Configstore from 'configstore';
import { v4 as uuidv4 } from 'uuid';
import { getPathInHome } from '../lib/settings.mjs';
const globalConfigDefaults = {
    /* disable stats collection*/
    telemetryDisabled: false,
    /* cliId */
    cliId: uuidv4(),
};
// Memoise config result so that we only load it once
let configStore: any;
/**
 * @returns {Promise<Configstore>}
 */
const getGlobalConfig = async function () {
    if (!configStore) {
        const configPath = getPathInHome(['config.json']);
        const defaults = { ...globalConfigDefaults };
        configStore = new Configstore("com.cloudpath", defaults, { configPath });
    }
    return configStore;
};
export const resetConfigCache = () => {
    configStore = undefined;
};
export default getGlobalConfig;
