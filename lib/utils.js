const fs = require('fs'),

    strip = require('strip-json-comments'),

    UTF8 = 'utf-8',

    /**
     * Check if string ends with the specified suffix.
     *
     * @param {String} str - Input string
     * @param {String} suffix - suffix to be checked
     * @returns {Boolean}
     */
    endsWith = (str, suffix) => {
        return str.indexOf(suffix, str.length - suffix.length) !== -1; // eslint-disable-line lodash/prefer-includes
    },

    /**
     * Check if string starts with the specified prefix.
     *
     * @param {String} str - Input string
     * @param {String} prefix - prefix to be checked
     * @returns {Boolean}
     */
    startsWith = (str, prefix) => {
        return str.slice(0, prefix.length) === prefix;
    },

    /**
     * Strip comments from JSON and Parse.
     *
     * @param {String} path - Path to JSON file
     * @returns {Object}
     */
    removeCommentsAndLoadJSON = (path) => {
        return JSON.parse(strip(fs.readFileSync(path, UTF8)));
    },

    /**
     * Recursively get all the schemas.
     *
     * @param {String} path - Path to schema file or directory
     * @param {String} schemaId - The unique identified for each sub-schema file
     * @param {Object} schemas - Resultant schema
     * @returns {Object}
     */
    _getAllSchemasRecurse = (path, schemaId, schemas) => {
        const stats = fs.lstatSync(path);
        let file;

        if (stats.isDirectory()) {
            fs.readdirSync(path).map((child) => {
                return _getAllSchemasRecurse(path + '/' + child, schemaId, schemas);
            });

            return schemas;
        }

        if (endsWith(path, '.json')) {
            file = removeCommentsAndLoadJSON(path);
            schemas[file[schemaId]] = file;
            if (!file[schemaId]) {
                console.warn(`WARNING: File: ${path} has no ${schemaId}`);
            }
        }

        return schemas;
    },

    /**
     * Load all schemas from the give path.
     *
     * @param {String} path - Path to schema file or directory
     * @param {String} schemaId - The primary key .
     * @returns {Object}
     */
    getAllSchemas = function (path, schemaId) {
        return _getAllSchemasRecurse(path, schemaId, {});
    };

module.exports = {
    endsWith,
    startsWith,
    getAllSchemas,
    removeCommentsAndLoadJSON
};
