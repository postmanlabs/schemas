#!/usr/bin/env node

const program = require('commander'),

    schema = require('../lib');

program
    .option('--input <input>', 'Path to the JSON file containing the data to be validated')
    .option('--schema <schema>', 'Path to the JSON file containing the schema to validate against')
    .option('--schema-dir <schemaDir>', 'Path to the directory containing all the schemas')
    .option('--draft-version <draftVersion>', 'The JSON schema draft version (draft-04 or draft-07), inferred from $schema if omitted')
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

let valid;

try {
    valid = schema.validate(program.input, program.schema, program.schemaDir, program.draftVersion);
}
catch (err) {
    // Bad draft version or unreadable/invalid file: report it without a stack trace.
    console.error(`\n  error: ${err.message}`);
    process.exit(2);
}

if (valid) {
    console.info('Validation successful');
}
else {
    console.error('Validation failed');
    process.exitCode = 1;
}
