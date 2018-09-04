var fs = require('fs'),
    args = require('commander'),

    tools = require('../index');

function parseArguments() {
    args.option('--output [output]', 'Path to the output JSON file')
        .option('--schema [schema]', 'Path to the JSON file containing the schema to validate against')
        .option('--schema-dir [schemaDir]', 'Path to the directory containing all the schemas')
        .parse(process.argv);
}

function main() {
    var schema,
        result;

    parseArguments();

    if (!args.output) {
        console.log('"--output" parameter is required');
        process.exit(1);
    }
    if (!args.schema) {
        console.log('"--schema" parameter is required');
        process.exit(1);
    }
    if (!args.schemaDir) {
        console.log('"--schema-dir" parameter is required');
        process.exit(1);
    }
    result = tools.compile(args.schema, args.schemaDir);

    fs.writeFileSync(args.output, JSON.stringify(result, null, 4));
    console.log('Output written to file: ', args.output);
}

if (require.main == module) {
    main();
}
