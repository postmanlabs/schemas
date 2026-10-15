#!/usr/bin/env node

const fs = require('fs'),
    program = require('commander'),

    schema = require('../lib');

program
    .option('--output <output>', 'Path to the output JSON file')
    .option('--schema <schema>', 'Path to the JSON file containing the schema to validate against')
    .option('--schema-dir <schemaDir>', 'Path to the directory containing all the schemas')
    .option('--draft-version <draftVersion>', 'The JSON schema draft version (draft-04 or draft-07), inferred from $schema if omitted')
    .parse(process.argv);

if (!program.output) {
    console.error('\n  error: "--output" option is required');
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

let result;

try {
    result = schema.compile(program.schema, program.schemaDir, program.draftVersion);
}
catch (err) {
    console.error(`\n  error: ${err.message}`);
    process.exit(1);
}

fs.writeFileSync(program.output, JSON.stringify(result, null, 4));

console.info('Output written to file: ', program.output);
