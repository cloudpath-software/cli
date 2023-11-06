import logSymbols from 'log-symbols';
import ora from 'ora';
/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
export const startSpinner = ({ text }: any) => ora({
    text,
}).start();
/**
 * Stops the spinner with the following text
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @param {object} [config.error]
 * @param {string} [config.text]
 * @returns {void}
 */
export const stopSpinner = ({ error, spinner, text }: any) => {
    if (!spinner) {
        return;
    }
    // TODO: refactor no package needed `log-symbols` for that
    const symbol = error ? logSymbols.error : logSymbols.success;
    spinner.stopAndPersist({
        text,
        symbol,
    });
};
/**
 * Clears the spinner
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @returns {void}
 */
export const clearSpinner = ({ spinner }: any) => {
    if (spinner) {
        spinner.stop();
    }
};