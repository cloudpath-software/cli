import { SiteDeployState } from "@cloudpath/shared-models";
import { sep } from 'path';
import pWaitFor from 'p-wait-for';
import { DEPLOY_POLL } from './constants.mjs';
// normalize windows paths to unix paths
export const normalizePath = (relname: string) => {
    if (relname.includes('#') || relname.includes('?')) {
        throw new Error(`Invalid filename ${relname}. Deployed filenames cannot contain # or ? characters`);
    }
    return relname.split(sep).join('/');
};
// poll an async deployId until its done diffing
export const waitForDiff = async (api: any, deployId: string, siteId: string, timeout: number) => {
    // capture ready deploy during poll
    let deploy;
    const loadDeploy = async () => {
        const siteDeploy = await api.hosting.sites.id(siteId).deploys.retrieve(deployId);
        switch (siteDeploy.state) {
            case SiteDeployState.ERROR: {
                const deployError: any = new Error(siteDeploy.error || `Deploy ${deployId} had an error`);
                deployError.deploy = siteDeploy;
                throw deployError;
            }
            case SiteDeployState.PREPARED:
            case SiteDeployState.UPLOADING:
            case SiteDeployState.UPLOADED:
            case SiteDeployState.READY: {
                deploy = siteDeploy;
                return true;
            }
            case SiteDeployState.PREPARING:
            default: {
                return false;
            }
        }
    };
    await pWaitFor(loadDeploy, {
        interval: DEPLOY_POLL,
        timeout: {
            milliseconds: timeout,
            message: 'Timeout while waiting for deploy',
        },
    });
    // @ts-ignore
    return deploy;
};
// Poll a deployId until its ready
export const waitForDeploy = async (api: any, deployId: string, siteId: string, timeout: number) => {
    // capture ready deploy during poll
    let deploy;
    const loadDeploy = async () => {
        const siteDeploy = await api.hosting.sites.id(siteId).deploys.retrieve(deployId);
        switch (siteDeploy.state) {
            case SiteDeployState.ERROR: {
                const deployError: any = new Error(siteDeploy.error || `Deploy ${deployId} had an error`);
                deployError.deploy = siteDeploy;
                throw deployError;
            }
            case SiteDeployState.READY: {
                deploy = siteDeploy;
                return true;
            }
            case SiteDeployState.PREPARING:
            case SiteDeployState.PREPARED:
            case SiteDeployState.UPLOADED:
            case SiteDeployState.UPLOADING:
            default: {
                return false;
            }
        }
    };
    await pWaitFor(loadDeploy, {
        interval: DEPLOY_POLL,
        timeout: {
            milliseconds: timeout,
            message: 'Timeout while waiting for deploy',
        },
    });
    // @ts-ignore
    return deploy;
};
// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
export const getUploadList = (required: any, shaMap: any) => {
    if (!required || !shaMap)
        return [];
    return required.flatMap((sha: any) => shaMap[sha]);
};