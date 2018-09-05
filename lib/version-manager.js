const fs = require('fs'),
    path = require('path'),

    _ = require('lodash'),
    semver = require('semver'),
    mustache = require('mustache'),

    SCHEMA_DIR = path.join(__dirname, '..', 'schemas'),
    VERSION_URL_TEMPLATE = 'https://schema.getpostman.com/json/collection/{{version}}/',

    allVersions = fs.readdirSync(SCHEMA_DIR).sort((versionA, versionB) => {
        return (semver.gt(versionA, versionB)) ? versionA : versionB;
    }),

    allVersionSchemaDirMap = _.zipObject(_.map(allVersions, semver.clean), _.map(allVersions, (version) => {
        return path.join(SCHEMA_DIR, version);
    })),

    _versionExists = (versionString) => {
        return _.includes(allVersions, versionString);
    },

    _getVersionDirName = (version) => {
        return 'v' + version;
    },

    _getSchemaDirPath = (version) => {
        return path.join(SCHEMA_DIR, _getVersionDirName(version));
    },

    list = () => {
        allVersions.forEach((version) => {
            console.info('[*] - %s', version);
        });
    },

    create = (baseVersion, newVersion) => {
        let fromDir,
            toDir,
            schema;

        if (!baseVersion) {
            baseVersion = _.last(allVersions); // take the latest version as the base
        }
        if (!_versionExists(baseVersion)) {
            console.warn('No such version: ' + baseVersion);
            console.warn('Use the "list" option to see available versions');

            return;
        }
        if (!semver.valid(newVersion, true)) {
            console.error('Invalid new version: ' + newVersion);

            return;
        }
        baseVersion = semver.clean(baseVersion);
        newVersion = semver.clean(newVersion);

        fromDir = allVersionSchemaDirMap[baseVersion];
        toDir = _getSchemaDirPath(newVersion);
        console.info('Creating a new version "%s" using "%s" as the base', newVersion, baseVersion);
        console.info('Copying files from {%s} to {%s}', fromDir, toDir);

        try {
            fs.copySync(fromDir, toDir);
        }
        catch (e) {
            console.error('Unable to create the new version', e);

            return;
        }

        // Replace the version URL
        console.info('Replacing Schema ID URL');
        try {
            schema = JSON.parse(fs.readFileSync(path.join(toDir, 'collection.json')));
            schema.id = mustache.render(VERSION_URL_TEMPLATE, { version: _getVersionDirName(newVersion) });
            fs.writeFileSync(path.join(toDir, 'collection.json'), JSON.stringify(schema, null, 4));
        }
        catch (e) {
            console.error('Problem overwriting the new URL in created version, ' + toDir, e);

            return;
        }

        console.info('Version Created');
    };

module.exports = {
    list,
    create
};
