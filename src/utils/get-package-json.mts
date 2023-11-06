import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
let packageJson: any;
const getPackageJson = async () => {
    if (!packageJson) {
        const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json');
        const fileBuffer = await readFile(packageJsonPath);
        packageJson = JSON.parse(fileBuffer.toString("utf8"));
    }
    return packageJson;
};
export default getPackageJson;
