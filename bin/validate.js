#!/usr/bin/env node

var args = require('commander'),
    tools = require('..');

function parseArguments() {
    args.option('--input [input]', 'Path to the JSON file containing the data to be validated')
        .option('--schema [schema]', 'Path to the JSON file containing the schema to validate against')
        .option('--schema-dir [schemaDir]', 'Path to the directory containing all the schemas')
        .parse(process.argv);
}

function main() {
    var input,
        schema,
        result;

    parseArguments();

    if (!args.input) {
        console.log('"--input" parameter is required');
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
    result = tools.validate(args.input, args.schema, args.schemaDir);
    (result == true) ? console.log('Validation successful') : console.log('Validation failed, errors: ', result);
}

if (require.main == module) {
    main();
}
