/* global describe, it, expect */

var fs = require('fs'),
    path = require('path'),

    tv4 = require('tv4'),
    tools = require('../../index'),
    draft = require('../fixtures/meta-schema-v4.json'),

    schemaDir = path.normalize(path.join(__dirname, '..', '..', 'schemas'));

describe('compilation', function () {
    fs.readdirSync(schemaDir).forEach(function (version) {
        it(version + ' format matches the draft schema', function (done) {
            var schemaDirV1 = path.join(schemaDir, version),
                schemaPath = path.join(schemaDirV1, 'collection.json'),
                validator = tv4.freshApi(),
                generatedSchema = tools.compile(schemaPath, schemaDirV1), // The JSON to check.
                result;

            validator.addSchema(generatedSchema);
            result = validator.validate(generatedSchema, draft);
            expect(result).to.equal(true);
            done();
        });
    });
});
