#!/usr/bin/env node
import { argv } from 'process';
import updateNotifier from 'update-notifier';
import { createMainCommand } from './commands/index.mjs';
import getPackageJson from './utils/get-package-json.mjs';
// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5;
// @ts-ignore
const pkg = await getPackageJson();
try {
    updateNotifier({
        pkg,
        updateCheckInterval: UPDATE_CHECK_INTERVAL,
    }).notify();
}
catch (error) {
    console.log('Error checking for updates:');
    console.log(error);
}
const program = createMainCommand();
try {
    // @ts-ignore
    await program.parseAsync(argv);
    program.onEnd();
}
catch (error: any) {
    program.onEnd(error);
}
