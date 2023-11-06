import { env } from 'process';
// This is a thin layer on top of `execa` that allows consumers to provide an
// alternative path to the module location, making it easier to mock its logic
// in tests (see `tests/utils/mock-execa.js`).
/**
 * @type {import('execa')}
 */
let execa: any;
if (env.CLI_EXECA_PATH) {
    const execaMock = await import(env.CLI_EXECA_PATH);
    execa = execaMock.default;
}
else {
    execa = await import('execa');
}
export default execa;
