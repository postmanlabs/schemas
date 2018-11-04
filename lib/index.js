const _ = require('lodash'),
    Ajv = require('ajv'),

    nodeUtil = require('util'),

    versions = require('./version-manager'),
    utils = require('./utils'),

    META_SCHEMA = {
        'draft-04': require('ajv/lib/refs/json-schema-draft-04.json'),
        'draft-07': require('ajv/lib/refs/json-schema-draft-07.json')
    },

    /**
     * Completely resolves a schema, ensuring that no references remain.
     *
     * @param {String} schemaPath - Path to the JSON file containing the schema to validate against
     * @param {String} schemaDirPath - Path to the directory containing all the schemas
     * @param {String} draft - The JSON schema draft version to compile
     * @returns {Object}
     */
    compile = (schemaPath, schemaDirPath, draft) => {
        var schema = utils.removeCommentsAndLoadJSON(schemaPath),
            schemaId = draft === 'draft-04' ? 'id' : '$id',
            all = utils.getAllSchemas(schemaDirPath, schemaId),
            subSchemas = _.omit(all, schema[schemaId]);

        schema.definitions = _.mapKeys(subSchemas, (value, key) => {
            if (utils.startsWith(key, '#/definitions/')) {
                return key.replace('#/definitions/', '');
            }
        });

        return schema;
    },

    /**
     *
     * Validates a given JSON file against a bunch of nested schemas.
     *
     * @param {String} inputPath - Path to the input JSON File.
     * @param {String} schemaPath - Path to the schema which we need to validate against.
     * @param {String} schemaDirPath - Path to the directory containing all the schemas
     * @param {String} [draft=draft-07] - Path to the directory containing all the schemas
     * @returns {Boolean}
     */
    validate = (inputPath, schemaPath, schemaDirPath, draft) => {
        const input = utils.removeCommentsAndLoadJSON(inputPath),
            validator = new Ajv({
                schemaId: draft === 'draft-04' ? 'id' : '$id', // only use id keyword as schema URI
                meta: false, // to prevent adding draft-06 meta-schema
                allErrors: true // check all rules collecting all errors
            });

        // Adds schema that can be used to validate schemas
        validator.addMetaSchema(META_SCHEMA[draft]);

        let schema,
            validate,
            result;

        schema = compile(schemaPath, schemaDirPath, draft); // true => Completely dereferenced schema
        validate = validator.compile(schema);

        result = validate(input);

        !result && console.error(nodeUtil.inspect(validate.errors, {
            colors: true,
            depth: 10000
        }));

        return result;
    };

module.exports = {
    validate,
    compile,
    versions
};
