// @ts-check
import { chalk, log } from '../command-helpers.mjs';
const logSuccess = (repoData: any) => {
    log();
    log(chalk.greenBright.bold.underline(`Success! Cloudpath CI/CD Configured!`));
    log();
    log(`This site is now configured to automatically deploy from ${repoData.provider} branches & pull requests`);
    log();
    log(`Next steps:

  ${chalk.cyanBright.bold('git push')}       Push to your git repository to trigger new site builds
  ${chalk.cyanBright.bold('cloudpath open')}   Open the Cloudpath admin URL of your site
  `);
};