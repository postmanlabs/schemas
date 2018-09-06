const _ = require('lodash'),
    tv4 = require('tv4'),

    nodeUtil = require('util'),

    versions = require('./version-manager'),
    utils = require('./utils'),

    /**
     * Completely resolves a schema, ensuring that no references remain.
     *
     * @param {String} schemaPath - Path to the JSON file containing the schema to validate against
     * @param {String} schemaDirPath - Path to the directory containing all the schemas
     * @returns {Object}
     */
    compile = (schemaPath, schemaDirPath) => {
        var schema = utils.removeCommentsAndLoadJSON(schemaPath),
            all = utils.getAllSchemas(schemaDirPath),
            subSchemas = _.omit(all, schema.id);

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
     * @returns {Boolean}
     */
    validate = (inputPath, schemaPath, schemaDirPath) => {
        const input = utils.removeCommentsAndLoadJSON(inputPath),
            validator = tv4.freshApi();

        let schema,
            result;

        schema = compile(schemaPath, schemaDirPath); // true => Completely dereferenced schema
        validator.addSchema(schema);
        result = validator.validate(input, schema);
        !result && console.info(nodeUtil.inspect(validator.error, { colors: true, depth: 10000 }));

        if (validator.missing.length) {
            console.error(validator.missing);

            return false;
        }

        return result;
    };

module.exports = {
    validate,
    compile,
    versions
};
