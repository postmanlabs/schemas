#!/usr/bin/env node
var path = require('path'),

	_ = require('lodash'),
	fse = require('fs-extra'),
	semver = require('semver'),
    mustache = require('mustache'),

    tools = require('..'),

    SCHEMA_DIR = path.join(__dirname, '..', 'schemas'),
    BASE_ASSET_DIR = path.join(__dirname, '..', 'dist'),
    BASE_OUTPUT_DIR = path.join(__dirname, '..', 'webout'),
    OUTPUT_DIR = path.join(BASE_OUTPUT_DIR, 'json', 'collection'),
    STATUS_MAP_BOOTSTRAP = {
        draft: 'warning',
        stable: 'success',
        rc: 'primary'
    };

function buildVersion(version) {
    var versionDir = path.join(OUTPUT_DIR, version, 'docs'),
        outputSchemaFile = path.join(OUTPUT_DIR, version, 'collection.json'),
        schemaFile = path.join(SCHEMA_DIR, version, 'collection.json'),
        versionSchemaDir = path.join(SCHEMA_DIR, version),
        templateFile = path.join(BASE_ASSET_DIR, 'index.html.mustache'),
        compiledSchema = tools.compile(schemaFile, versionSchemaDir),
        templateContent = fse.readFileSync(templateFile),
        renderedTemplate;
    console.log('Building docs for %s ...', version);
    fse.mkdirpSync(versionDir);
    console.log('Created directory %s', versionDir);
    fse.writeFileSync(outputSchemaFile, JSON.stringify(compiledSchema, null, 4));

    // Compile the mustache template
    renderedTemplate = mustache.render(templateContent.toString(), {version: version});
    fse.writeFileSync(path.join(versionDir, 'index.html'), renderedTemplate);
}

function buildLatest(version) {
    var versionDocsDir = path.join(OUTPUT_DIR, version),
        latestDocsDir = path.join(OUTPUT_DIR, 'latest');
    fse.copySync(versionDocsDir, latestDocsDir);
    console.log('Copied %s as the latest version', version);
}

function getStableVersions(versions) {
    return versions.filter(function (val) {
        return /v[0-9]+\.[0-9]+\.[0-9]+$/i.test(val);
    });
}

function getLatestStable(versions) {
    return _.reduce(getStableVersions(versions), function (versionA, versionB) {
        return (semver.gt(semver.clean(versionA), semver.clean(versionB), true)) ? versionA: versionB;
    })
}

function buildSymlinks(versions) {
    var stableVersions = getStableVersions(versions),

        // groups versions by major: { "1": ["1.0.1", "1.2.0"], "2": ["2.0.0", "2.1.0"]
        groupedByMajor = _.groupBy(stableVersions, function (version) {
            return semver.major(version, true);
        }),

        //  [
        //      {"major": "1", "latest": "1.2.0"},
        //      {"major": "2", "latest": "2.1.0"}
        //  ]
        mapping = _.map(groupedByMajor, function (versions, major) {
            return {
                major: major,
                latest: _.reduce(versions, function (versionA, versionB) {
                    return (semver.gt(semver.clean(versionA), semver.clean(versionB), true)) ? versionA : versionB;
                })
            };
        });

    mapping = _.zipObject(_.map(mapping, 'major'), _.map(mapping, 'latest'));

    _.map(mapping, function (latest, major) {
        var src = path.relative(OUTPUT_DIR, path.join(OUTPUT_DIR, latest)),
            dest = path.join(OUTPUT_DIR, 'v' + major.toString());
        fse.symlinkSync(src, dest);
    })
}

function buildToc (versions) {
    var templateFile = path.join(BASE_ASSET_DIR, 'table_of_contents.html.mustache'),
        templateContent = fse.readFileSync(templateFile),
        renderedTemplate,
        allversions;
    console.log('Creating a Table of Contents...');
    allversions = _.map(versions, function (version) {
        var rawVersion = version,
            semVersion = semver.SemVer(version),
            status,
            bootstrapClass;
        if (_.isArray(semVersion.prerelease) && semVersion.prerelease.length) {
            status = _.isArray(semVersion.prerelease) ? semVersion.prerelease[0] : semVersion.prerelease;
        }
        else {
            status = 'stable'
        }
        bootstrapClass = STATUS_MAP_BOOTSTRAP[status];
        if (!bootstrapClass) {
            throw new Error('Invalid status "' + status + '". Please use a valid semver pre-release tag. ' +
                'It should be one of ' + _.keys(STATUS_MAP_BOOTSTRAP));
        }
        return {
            raw: rawVersion,
            status: status,
            bootstrapClass: bootstrapClass
        };
    });
    renderedTemplate = mustache.render(templateContent.toString(), {versions: allversions});
    fse.writeFileSync(path.join(BASE_OUTPUT_DIR, 'index.html'), renderedTemplate);
}

function main() {
    var versions = fse.readdirSync(SCHEMA_DIR);

    // Ensures that versions are displayed in the descending order in the ToC
    versions.sort(semver.rcompare);
    console.log('Output directory is: %s', OUTPUT_DIR);

    // Check if output directory exists, and remove it if it's there
    if(fse.existsSync(OUTPUT_DIR)) {
        console.log('Output directory exists! Removing the existing one.');
        fse.removeSync(OUTPUT_DIR);
    }
    // Create output directory
    fse.mkdirpSync(OUTPUT_DIR);

    // Copy statics assets (js, css, etc)
    fse.copySync(BASE_ASSET_DIR, OUTPUT_DIR);

    // Create the table of contents
    buildToc(versions);

    versions.forEach(buildVersion);

    // Remove templates from output directory.
    fse.remove(path.join(OUTPUT_DIR, 'index.html.mustache'));
    fse.remove(path.join(OUTPUT_DIR, 'table_of_contents.html.mustache'));


    // Construct the docs for the latest stable version.
    console.log('Building docs for the latest...');
    buildLatest(getLatestStable(versions));

    // Create symlinks for stable versions.. v1 => v1.0.0, etc.
    console.log('Creating symlinks from major versions to the latest...');
    buildSymlinks(versions);
}

main();
