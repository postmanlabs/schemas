#!/usr/bin/env node

const program = require('commander'),

    schema = require('..');

program
    .option('--input <input>', 'Path to the JSON file containing the data to be validated')
    .option('--schema <schema>', 'Path to the JSON file containing the schema to validate against')
    .option('--schema-dir <schemaDir>', 'Path to the directory containing all the schemas')
    .parse(process.argv);

if (!program.input) {
    console.error('\n  error: "--input" option is required');
    process.exit(1);
}
if (!program.schema) {
    console.error('\n  error: "--schema" option is required');
    process.exit(1);
}
if (!program.schemaDir) {
    console.error('\n  error: "--schema-dir" option is required');
    process.exit(1);
}

schema.validate(program.input, program.schema, program.schemaDir) ?
    console.info('Validation successful') :
    console.error('Validation failed');
