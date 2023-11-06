import process from 'process'

const id = (message) => message

/**
 *
 * @param {string} message
 * @param {Array<chalk['Color'] | chalk['Modifiers']>} styles
 * @returns
 */
const format = async (message, styles) => {
    let func = id
    try {
        // this fails sometimes on outdated npm versions
        const chalk = await import('chalk')
        func = chalk.default
        styles.forEach((style) => {
            func = func[style]
        })
    } catch {}
    return func(message)
}

const postInstall = async () => {
    // yarn plug and play seems to have an issue with reading an esm file by building up the cache.
    // as yarn pnp analyzes everything inside the postinstall
    if (!process.argv[1].includes('.yarn')) {
        const { createMainCommand } = await import('../src/commands/index.mjs')
        // TODO: use destructuring again once the imported file is esm
        const { generateAutocompletion } = await import('../src/lib/completion/index.mjs')

        // create or update the autocompletion definition
        const program = createMainCommand()
        generateAutocompletion(program)
    }

    console.log('')
    console.log(await format('Success! Cloudpath CLI has been installed!', ['greenBright', 'bold', 'underline']))
    console.log('')
    console.log('Your device is now configured to use Cloudpath CLI to deploy and manage your Cloudpath sites.')
    console.log('')
    console.log('Next steps:')
    console.log('')
    console.log(
        `  ${await format('cloudpath init', [
            'cyanBright',
            'bold',
        ])}     Connect or create a Cloudpath site from current directory`,
    )
    console.log(
        `  ${await format('cloudpath deploy', ['cyanBright', 'bold'])}   Deploy the latest changes to your site`,
    )
    console.log('')
    console.log(`For more information on the CLI run ${await format('cloudpath help', ['cyanBright', 'bold'])}`)
    console.log(`Or visit the docs at ${await format('https://docs.cloudpath.app/cli/get-started/', ['cyanBright', 'bold'])}`)
    console.log('')
}

await postInstall()