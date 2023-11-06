import cleanDeep from 'clean-deep';
import { DEFAULT_CONCURRENT_HASH, DEFAULT_CONCURRENT_UPLOAD, DEFAULT_DEPLOY_TIMEOUT, DEFAULT_MAX_RETRY, DEFAULT_SYNC_LIMIT, } from './constants.mjs';
import hashFiles from './hash-files.mjs';
import uploadFiles from './upload-files.mjs';
import { getUploadList, waitForDeploy, waitForDiff } from './util.mjs';
import {deployFileNormalizer} from "./files.mjs";

export const deploySite = async (
    api: any,
    siteId: string,
    dir: any,
    {
        assetType,
        branch,
        concurrentHash = DEFAULT_CONCURRENT_HASH,
        concurrentUpload = DEFAULT_CONCURRENT_UPLOAD,
        configPath = null,
        deployId: deployIdOpt = null,
        deployTimeout = DEFAULT_DEPLOY_TIMEOUT,
        draft = false,
        filter,
        hashAlgorithm,
        manifestPath,
        maxRetry = DEFAULT_MAX_RETRY,
        // API calls this the 'title'
        message: title,
        // rootDir,
        siteEnv,
        statusCb = () => { /* default to noop */},
        syncFileLimit = DEFAULT_SYNC_LIMIT
    }: any = {}
) => {
    statusCb({
        type: 'hashing',
        msg: `Hashing files...`,
        phase: 'start',
    });
    const [{ files, filesShaMap }] = await Promise.all([
        hashFiles({
            assetType,
            concurrentHash,
            directories: [configPath, dir].filter(Boolean),
            filter,
            hashAlgorithm,
            normalizer: deployFileNormalizer.bind(null, "rootDir"),
            statusCb,
        }),
    ]);
    const filesCount = Object.keys(files).length;
    const stats = buildStatsString([
        filesCount > 0 && `${filesCount} files`,
    ]);
    statusCb({
        type: 'hashing',
        msg: `Finished hashing ${stats}`,
        phase: 'stop',
    });
    if (filesCount === 0) {
        throw new Error('No files or functions to deploy');
    }
    statusCb({
        type: 'create-deploy',
        msg: 'CDN diffing files...',
        phase: 'start',
    });
    let deploy;
    // @ts-ignore
    let deployParams: any = cleanDeep({
        siteId,
        body: {
            files,
            async: Object.keys(files).length > syncFileLimit,
            branch,
            draft,
        },
    });
    if (deployIdOpt === null) {
        if (title) {
            deployParams = { ...deployParams, title };
        }
        deploy = await api.hosting.sites.id(siteId).deploys.create("cli-test", { files });
    }
    else {
        deployParams = { ...deployParams, deploy_id: deployIdOpt };
        // deploy = await api.updateSiteDeploy(deployParams)
    }
    if (deployParams.body.async)
        deploy = await waitForDiff(api, deploy.id, siteId, deployTimeout);
    const { id: deployId, required: requiredFiles } = deploy;
    statusCb({
        type: 'create-deploy',
        msg: `CDN requesting ${requiredFiles.length} files`,
        phase: 'stop',
    });
    const filesUploadList = getUploadList(requiredFiles, filesShaMap);
    const uploadList = [...filesUploadList];
    await uploadFiles(api, deployId, uploadList, { concurrentUpload, statusCb, maxRetry });
    statusCb({
        type: 'wait-for-deploy',
        msg: 'Waiting for deploy to go live...',
        phase: 'start',
    });
    deploy = await waitForDeploy(api, deployId, siteId, deployTimeout);
    statusCb({
        type: 'wait-for-deploy',
        msg: draft ? 'Draft deploy is live!' : 'Deploy is live!',
        phase: 'stop',
    });
    return {
        deployId,
        deploy,
        uploadList,
    };
};
const buildStatsString = (possibleParts: any) => {
    const parts = possibleParts.filter(Boolean);
    const message = parts.slice(0, -1).join(', ');
    return parts.length > 1 ? `${message} and ${parts[parts.length - 1]}` : message;
};