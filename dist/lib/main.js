removePrivate = function (schema) {
    if (Array.isArray(schema)) {
        schema.forEach(function (subSchema) {
            removePrivate(subSchema);
        });
    }

    if (typeof schema === 'object') {
        for (var key in schema) {
            if (schema.hasOwnProperty(key)) {
                if (/^_postman/.test(key)) {
                    console.log('Deleting ' + key);
                    delete schema[key];
                }
                removePrivate(schema[key]);
            }
        }
    }
};

define([], function() {
    return {
        removePrivate: removePrivate
    };
});
