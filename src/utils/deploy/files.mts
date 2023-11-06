export const deployFileNormalizer = (rootDir: string, file: any) => {
	const normalizedPath = file.normalizedPath;
	return {
		...file,
		normalizedPath,
	};
};