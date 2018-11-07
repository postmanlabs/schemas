const fs = require('fs'),
    path = require('path'),

    _ = require('lodash'),
    semver = require('semver'),
    mustache = require('mustache'),

    SCHEMA_DIR = path.join(__dirname, '..', 'schemas'),
    VERSION_URL_TEMPLATE = 'https://schema.getpostman.com/json/collection/{{version}}/',

    allVersions = fs.readdirSync(SCHEMA_DIR).reduce((result, draft) => {
        result[draft] = fs.readdirSync(SCHEMA_DIR + '/' + draft)
            .sort((versionA, versionB) => {
                return (semver.gt(versionA, versionB)) ? versionA : versionB;
            });

        return result;
    }, {}),

    allVersionSchemaDirMap = _.transform(allVersions, (result, versions, draft) => {
        result[draft] = versions.reduce((data, version) => {
            version = semver.clean(version);
            data[version] = path.join(SCHEMA_DIR, draft, version);

            return data;
        }, {});
    }, {}),

    _versionExists = (versionString, draft = 7) => {
        return _.includes(allVersions[draft], versionString);
    },

    _getVersionDirName = (version) => {
        return 'v' + version;
    },

    _getSchemaDirPath = (version, draft = 7) => {
        return path.join(SCHEMA_DIR, 'draft-0' + draft, _getVersionDirName(version));
    },

    list = (draft = 7) => {
        allVersions['draft-0' + draft].forEach((version) => {
            console.info('[*] - %s', version);
        });
    },

    create = (baseVersion, newVersion, draft = 7) => {
        let fromDir,
            toDir,
            schema;

        if (!baseVersion) {
            baseVersion = _.last(allVersions[draft]); // take the latest version as the base
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

        fromDir = allVersionSchemaDirMap[draft][baseVersion];
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
