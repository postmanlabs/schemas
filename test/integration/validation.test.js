/* global describe, it, expect */

const fs = require('fs'),
    path = require('path'),

    schema = require('../..'),

    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas')),
    exampleDir = path.normalize(path.join(__dirname, '..', '..', 'examples'));

describe('Validation', function () {
    fs.readdirSync(exampleDir).forEach((version) => {
        const examples = fs.readdirSync(path.join(exampleDir, version)),
            schemaDirVersion = path.join(schemaDir, version);

        describe(version + ' examples must be validated by the corresponding schema', function () {
            examples.forEach((example) => {
                it('Validating example: ' + example, function (done) {
                    const input = path.join(exampleDir, version, example),
                        schemaFilePath = path.join(schemaDirVersion, 'collection.json'),
                        result = schema.validate(input, schemaFilePath, schemaDirVersion);

                    expect(result).to.equal(true);
                    done();
                });
            });
        });
    });
});
