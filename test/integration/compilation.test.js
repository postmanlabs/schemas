/* global describe, it, expect */

var fs = require('fs'),
    path = require('path'),

    Ajv = require('ajv'),

    schema = require('../..'),
    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas')),

    META_SCHEMA = require('ajv/lib/refs/json-schema-draft-04.json');

describe('compilation', function () {
    fs.readdirSync(schemaDir).forEach(function (version) {
        it(version + ' format matches the draft schema', function (done) {
            const schemaDirV1 = path.join(schemaDir, version),
                schemaPath = path.join(schemaDirV1, 'collection.json'),
                generatedSchema = schema.compile(schemaPath, schemaDirV1), // The JSON to check.
                validator = new Ajv({
                    schemaId: 'id', // only use id keyword as schema URI
                    meta: false, // to prevent adding draft-06 meta-schema
                    allErrors: true // check all rules collecting all errors
                });

            let validate;

            // override `uri` format to `uri-reference`
            validator.addFormat('uri', validator._formats['uri-reference']);

            validate = validator.compile(META_SCHEMA);

            expect(validate(generatedSchema)).to.be.true;
            done();
        });
    });
});
