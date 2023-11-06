import {RestClient} from "@cloudpath/js-api";
import { fileFromPath } from 'formdata-node/file-from-path';
import fs from 'fs';
import backoff from 'backoff';
import pMap from 'p-map';
import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.mjs';
const uploadFiles = async (api: RestClient, bucketId: string, uploadList: any, { concurrentUpload, maxRetry, statusCb }: any, folderId?: string) => {
    if (!concurrentUpload || !statusCb || !maxRetry)
        throw new Error('Missing required option concurrentUpload');
    statusCb({
        type: 'upload',
        msg: `Uploading ${uploadList.length} files`,
        phase: 'start',
    });
    const uploadFile = async (fileObj: any, index: number) => {
        const { assetType, filepath, normalizedPath } = fileObj;
        const readStreamCtor = () => fs.createReadStream(filepath);
        statusCb({
            type: 'upload',
            msg: `(${index}/${uploadList.length}) Uploading ${normalizedPath}...`,
            phase: 'progress',
        });
        let response;
        switch (assetType) {
            case 'file': {
                const file = await fileFromPath(filepath);
                response = await retryUpload(() => folderId ?
                    api.cdn.bucket.withId(bucketId).nodes().withId(folderId).uploadFile(file) :
                    api.cdn.bucket.withId(bucketId).nodes().uploadFile(file), maxRetry)
                console.log(file.name, (response as any))
                break;
            }
            default: {
                const error: any = new Error('File Object missing assetType property');
                error.fileObj = fileObj;
                throw error;
            }
        }
        return response;
    };
    const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload });
    statusCb({
        type: 'upload',
        msg: `Finished uploading ${uploadList.length} assets`,
        phase: 'stop',
    });
    return results;
};
const retryUpload = (uploadFn: any, maxRetry: any) => new Promise((resolve, reject) => {
    let lastError: any;
    const fibonacciBackoff = backoff.fibonacci({
        randomisationFactor: UPLOAD_RANDOM_FACTOR,
        initialDelay: UPLOAD_INITIAL_DELAY,
        maxDelay: UPLOAD_MAX_DELAY,
    });
    const tryUpload = async (retryIndex = -1) => {
        try {
            const results = await uploadFn(retryIndex + 1);
            return resolve(results);
        }
        catch (error: any) {
            lastError = error;
            // observed errors: 408, 401 (4** swallowed), 502
            if (error.status >= 400 || error.name === 'FetchError') {
                fibonacciBackoff.backoff();
                return;
            }
            return reject(error);
        }
    };
    fibonacciBackoff.failAfter(maxRetry);
    fibonacciBackoff.on('backoff', () => {
        // Do something when backoff starts, e.g. show to the
        // user the delay before next reconnection attempt.
    });
    fibonacciBackoff.on('ready', tryUpload);
    fibonacciBackoff.on('fail', () => {
        reject(lastError);
    });
    tryUpload();
});
export default uploadFiles;