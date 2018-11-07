/* global describe, it, expect */

const fs = require('fs'),
    path = require('path'),

    schema = require('../..'),

    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas')),
    exampleDir = path.normalize(path.join(__dirname, '..', '..', 'examples'));

describe('Validation', function () {
    fs.readdirSync(schemaDir).forEach((draft) => {
        describe(draft, function () {
            fs.readdirSync(path.join(exampleDir, draft)).forEach((version) => {
                const examples = fs.readdirSync(path.join(exampleDir, draft, version)),
                    schemaDirVersion = path.join(schemaDir, draft, version);

                describe(`${version} examples must be validated by the corresponding ${draft} schema`, function () {
                    examples.forEach((example) => {
                        it('Validating example: ' + example, function (done) {
                            const input = path.join(exampleDir, draft, version, example),
                                schemaFilePath = path.join(schemaDirVersion, 'collection.json'),
                                result = schema.validate(input, schemaFilePath, schemaDirVersion, draft);

                            expect(result).to.equal(true);
                            done();
                        });
                    });
                });
            });
        });
    });
});
