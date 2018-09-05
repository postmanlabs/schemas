/* global describe, it, expect */

var fs = require('fs'),
    path = require('path'),

    tools = require('../../index'),
    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas')),
    exampleDir = path.normalize(path.join(__dirname, '..', '..', 'examples'));

describe('Validation', function () {
    fs.readdirSync(exampleDir).forEach(function (version) {
        var examples = fs.readdirSync(path.join(exampleDir, version)),
            schemaDirVersion = path.join(schemaDir, version);

        describe(version + ' examples must be validated by the corresponding schema', function () {
            examples.forEach(function (example) {
                it('Validating example: ' + example, function (done) {
                    var input = path.join(exampleDir, version, example),
                        schemaFilePath = path.join(schemaDirVersion, 'collection.json'),
                        result = tools.validate(input, schemaFilePath, schemaDirVersion);

                    expect(result).to.equal(true);
                    done();
                });
            });
        });
    });
});
