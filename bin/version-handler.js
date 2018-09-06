#!/usr/bin/env node

const program = require('commander'),
    version = require('../package.json').version,

    schema = require('..');

program
    .usage('<command> [options]')
    .version(version, '-v, --version');

program
    .command('list')
    .description('Show the list of available Collection Schema versions')
    .action(() => {
        schema.versions.list();
    });

program
    .command('create')
    .description('Create a new version of schema based on another version.')
    .option('-b, --base <base>', 'The version to use as a base [defaults to the latest version]')
    .option('-n --new <new>', 'The new version to create')
    .action((options) => {
        schema.versions.create(options.base, options.new);
    });

program.on('command:*', (command) => {
    console.error(`\n  error: invalid command \`${command}\`\n`);
    program.help();
});

program.parse(process.argv);
