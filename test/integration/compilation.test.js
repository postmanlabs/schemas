/* global describe, it, expect */

const fs = require('fs'),
    path = require('path'),

    Ajv = require('ajv'),

    schema = require('../..'),
    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas')),

    draftKeywordMap = {
        'draft-04': 'id',
        'draft-07': '$id'
    },
    META_SCHEMA = {};

describe('compilation', function () {
    fs.readdirSync(schemaDir).forEach((draft) => {
        META_SCHEMA[draft] = require(`ajv/lib/refs/json-schema-${draft}.json`);

        describe(draft, function () {
            fs.readdirSync(path.join(schemaDir, draft)).forEach((version) => {
                it(`${version} format matches the draft ${draft} schema`, function (done) {
                    const schemaDirV1 = path.join(schemaDir, draft, version),
                        schemaPath = path.join(schemaDirV1, 'collection.json'),
                        generatedSchema = schema.compile(schemaPath, schemaDirV1, draft), // The JSON to check.
                        validator = new Ajv({
                            schemaId: draftKeywordMap[draft],
                            meta: draft !== 'draft-04',
                            allErrors: true // check all rules collecting all errors
                        });

                    let validate;

                    // override `uri` format to `uri-reference`
                    (draft === 'draft-04') && validator.addFormat('uri', validator._formats['uri-reference']);

                    validate = validator.compile(META_SCHEMA[draft]);

                    expect(validate(generatedSchema)).to.be.true;
                    done();
                });
            });
        });
    });
});
