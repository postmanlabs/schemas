#!/usr/bin/env node

const path = require('path'),

    _ = require('lodash'),
    fse = require('fs-extra'),
    semver = require('semver'),
    mustache = require('mustache'),

    tools = require('../index'),

    DEFAULT_DRAFT = 'draft-04',
    SCHEMA_DIR = path.join(__dirname, '..', 'schemas'),
    BASE_ASSET_DIR = path.join(__dirname, '..', 'dist'),
    BASE_OUTPUT_DIR = path.join(__dirname, '..', 'webout'),
    OUTPUT_DIR = path.join(BASE_OUTPUT_DIR, 'json'),
    ELEMENTS = ['collection', 'environment'],
    NEW_OUTPUT_DIR = (element) => {
        return path.join(BASE_OUTPUT_DIR, element, 'json');
    },

    STATUS_MAP_BOOTSTRAP = {
        draft: 'warning',
        stable: 'success',
        rc: 'primary'
    };

/**
 * @param {String} version - Schema Version
 * @param {String} draft - The JSON draft version to build for.
 * @param {String} element - The element to build for.
 */
function buildVersion (version, draft, element) {
    const schemaFile = path.join(SCHEMA_DIR, draft, version, `${element}.json`);

    if (!fse.existsSync(schemaFile)) {
        console.info(`Skipping ${version} for ${element} as it does not have a schema file`);

        return;
    }

    let isLatestDraft = draft === DEFAULT_DRAFT,
        draftSubDir = isLatestDraft ? '' : draft,
        versionDir = path.join(NEW_OUTPUT_DIR(element), version, draft, 'docs'),
        outSchemaFile = path.join(NEW_OUTPUT_DIR(element), version, draft, `${element}.json`),
        legacyVersionDir = path.join(OUTPUT_DIR, draftSubDir, element, version, 'docs'),
        legacyOutSchemaFile = path.join(OUTPUT_DIR, draftSubDir, element, version, `${element}.json`),
        versionSchemaDir = path.join(SCHEMA_DIR, draft, version),
        templateFile = path.join(BASE_ASSET_DIR, `${element}.mustache`),
        compiledSchema = tools.compile(schemaFile, versionSchemaDir, draft),
        templateContent = fse.readFileSync(templateFile),
        renderedTemplate,
        legacyRenderedTemplate;

    console.info('Building docs for %s ...', version);
    fse.mkdirpSync(versionDir);
    fse.mkdirpSync(legacyVersionDir);

    console.info('Created directory %s', legacyVersionDir);
    fse.writeFileSync(outSchemaFile, JSON.stringify(compiledSchema, null, 4));
    fse.writeFileSync(legacyOutSchemaFile, JSON.stringify(compiledSchema, null, 4));

    // Compile the mustache template
    renderedTemplate = mustache.render(templateContent.toString(), {
        draft: draft,
        version: version,
        root: '../../../../..'
    });
    legacyRenderedTemplate = mustache.render(templateContent.toString(), {
        draft: draft,
        version: version,
        root: `../../../..${isLatestDraft ? '' : '/..'}`
    });

    fse.writeFileSync(path.join(versionDir, 'index.html'), renderedTemplate);
    fse.writeFileSync(path.join(legacyVersionDir, 'index.html'), legacyRenderedTemplate);
}

/**
 *
 * @param {String} version - Schema Version
 * @param {String} draft - The JSON draft version to build for
 * @param {String} element - The element to build for
 */
function buildLatest (version, draft, element) {
    const versionDocsDir = path.join(NEW_OUTPUT_DIR(element), version, draft),
        latestDocsDir = path.join(NEW_OUTPUT_DIR(element), 'latest', draft),
        legacyVersionDocsDir = path.join(OUTPUT_DIR, draft === DEFAULT_DRAFT ? '' : draft, element, version),
        legacyLatestDocsDir = path.join(OUTPUT_DIR, draft === DEFAULT_DRAFT ? '' : draft, element, 'latest');

    fse.existsSync(versionDocsDir) && fse.copySync(versionDocsDir, latestDocsDir);
    fse.existsSync(legacyVersionDocsDir) && fse.copySync(legacyVersionDocsDir, legacyLatestDocsDir);
    console.info('Copied %s as the latest version', version);
}

/**
 *
 * @param {String[]} versions - Schema Versions
 */
function getStableVersions (versions) {
    return versions.filter((val) => {
        return (/v\d+\.\d+\.\d+$/i).test(val);
    });
}

/**
 *
 * @param {String[]} versions - Schema Versions
 */
function getLatestStable (versions) {
    return _.reduce(getStableVersions(versions), (versionA, versionB) => {
        return (semver.gt(semver.clean(versionA), semver.clean(versionB), true)) ? versionA : versionB;
    });
}

/**
 * @param {String[]} versions - Schema Versions
 * @param {String} draft - The JSON draft version to build for
 * @param {String} element - The element to build for
 */
function buildSymlinks (versions, draft, element) {
    const stableVersions = getStableVersions(versions),

        // groups versions by major: { "1": ["1.0.1", "1.2.0"], "2": ["2.0.0", "2.1.0"]
        groupedByMajor = _.groupBy(stableVersions, (version) => {
            return semver.major(version, true);
        });

    //  [
    //      {"major": "1", "latest": "1.2.0"},
    //      {"major": "2", "latest": "2.1.0"}
    //  ]
    let mapping = _.map(groupedByMajor, (versions, major) => {
        return {
            major: major,
            latest: _.reduce(versions, (versionA, versionB) => {
                return (semver.gt(semver.clean(versionA), semver.clean(versionB), true)) ? versionA : versionB;
            })
        };
    });

    mapping = _.zipObject(_.map(mapping, 'major'), _.map(mapping, 'latest'));

    _.forEach(mapping, (latest, major) => {
        const src = path.relative(NEW_OUTPUT_DIR(element), path.join(NEW_OUTPUT_DIR(element), element, 'json', latest)),
            dest = path.join(NEW_OUTPUT_DIR(element), 'v' + major.toString()),
            legacySrc = path.relative(OUTPUT_DIR, path.join(OUTPUT_DIR, element, latest)),
            legacyDest = path.join(OUTPUT_DIR, draft === DEFAULT_DRAFT ? '' : draft, element, 'v' + major);

        (draft === DEFAULT_DRAFT) && fse.symlinkSync(src, dest);
        fse.symlinkSync(legacySrc, legacyDest);
    });
}

/**
 * @param {String[]} versions - Schema Versions
 * @param {String} draft - The JSON draft version to build for.
 */
function buildToc (versions, draft) {
    console.info('Creating a Table of Contents...');

    const templateFile = path.join(BASE_ASSET_DIR, 'table_of_contents.mustache'),
        templateContent = fse.readFileSync(templateFile),

        allVersions = _.reduce(ELEMENTS, (acc, element) => {
            acc[element] = _.reduce(versions, (acc, version) => {
                let raw = version,
                    semVersion = new semver.SemVer(version),
                    status,
                    bootstrapClass;

                // check if schema file for this element exists
                if (!fse.existsSync(path.join(SCHEMA_DIR, draft, version, `${element}.json`))) {
                    return acc;
                }

                status = _.isArray(semVersion.prerelease) && semVersion.prerelease.length ?
                    semVersion.prerelease[0] : 'stable';

                bootstrapClass = STATUS_MAP_BOOTSTRAP[status];

                if (!bootstrapClass) {
                    throw new Error('Invalid status "' + status + '". Please use a valid semver pre-release tag. ' +
                        'It should be one of ' + _.keys(STATUS_MAP_BOOTSTRAP));
                }

                acc.push({
                    raw,
                    status,
                    bootstrapClass
                });

                return acc;
            }, []);

            return acc;
        }, {}),

        renderedTemplate = mustache.render(templateContent.toString(), {
            collections: allVersions.collection,
            environments: allVersions.environment
        });

    fse.writeFileSync(path.join(BASE_OUTPUT_DIR, 'index.html'), renderedTemplate);
}

/**
 * Main handler
 */
function main () {
    ELEMENTS.forEach((element) => {
        const outputDir = path.join(BASE_OUTPUT_DIR, element, 'json');

        // Check if output directory exists, and remove it if it's there
        if (fse.existsSync(outputDir)) {
            console.info('Output directory exists! Removing the existing one.');
            fse.removeSync(outputDir);
        }

        fse.mkdirpSync(outputDir);
    });

    // Copy statics assets (js, css, etc)
    fse.copySync(BASE_ASSET_DIR, BASE_OUTPUT_DIR);

    fse.readdirSync(SCHEMA_DIR).forEach((draft) => {
        const versions = fse.readdirSync(path.join(SCHEMA_DIR, draft));

        // Ensures that versions are displayed in the descending order in the ToC
        versions.sort(semver.rcompare);

        // Create the table of contents
        buildToc(versions, draft);

        ELEMENTS.forEach((element) => {
            versions.forEach((version) => {
                buildVersion(version, draft, element);
            });
        });

        ELEMENTS.forEach((element) => {
            const outDir = path.join(OUTPUT_DIR, draft === DEFAULT_DRAFT ? '' : draft, element);

            console.info('Output directory is: %s', outDir);

            // Check if output directory exists, and remove it if it's there
            if (fse.existsSync(outDir)) {
                console.info('Output directory exists! Removing the existing one.');
                fse.removeSync(outDir);
            }

            // Create output directory
            fse.mkdirpSync(outDir);

            // Remove templates from output directory.
            fse.remove(path.join(outDir, 'index.mustache'));
            fse.remove(path.join(outDir, 'table_of_contents.mustache'));

            // Construct the docs for the latest stable version.
            console.info('Building docs for the latest...');
            buildLatest(getLatestStable(versions), draft, element);

            // Create symlinks for stable versions.. v1 => v1.0.0, etc.
            console.info('Creating symlinks from major versions to the latest...');
            buildSymlinks(versions, draft, element);
        });
    });
}

main();
