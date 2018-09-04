var program = require('commander'),
    tools = require('../index');

program
    .usage('[command] [options]')
    .version(require('../package.json').version);

program
    .command('list')
    .description('Show the list of available Collection Schema versions')
    .action(function () {
        tools.versions.list();
    });

program
    .command('create')
    .description('Create a new version of schema based on another version.')
    .option('-b, --base [base]', 'The version to use as a base [defaults to the latest version]')
    .option('-n --new [new]', 'The new version to create')
    .action(function (options) {
        tools.versions.create(options.base, options.new);
    });


program
    .command('*', 'Display usage text', {isDefault: true})
    .action(function () {
        program.outputHelp();
    });

program.parse(process.argv);
