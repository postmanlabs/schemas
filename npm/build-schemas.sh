#!/bin/bash

set -e

echo "Compiling schemas, working directory is: " $PWD

ALL_SCHEMA_DIR=$PWD/schemas
COMPILED_SCHEMA_DIR=$PWD/compiled-schemas/json
ELEMENTS=("collection" "environment")

echo "Schema directory is: " ${ALL_SCHEMA_DIR}

for draftVersionDir in schemas/*; do
    draftVersion=$(basename ${draftVersionDir});

    for versionDir in ${draftVersionDir}/*; do
        [ -d ${versionDir} ] || continue # if not a directory, skip
        version=$(basename ${versionDir})
        echo "----- Compiling Version [${version}] -----"
        CURRENT_SCHEMA_DIR=${ALL_SCHEMA_DIR}/${draftVersion}/${version}

        for element in "${ELEMENTS[@]}"; do
            # if the schema doesn't exist, nothing to do
            [ -f "${CURRENT_SCHEMA_DIR}/${element}.json" ] || continue;

            if [[ ${draftVersion} == "draft-07" ]]; then
                OUTPUT_DIR=${COMPILED_SCHEMA_DIR}/${element}/${version}
            else
                OUTPUT_DIR=${COMPILED_SCHEMA_DIR}/${draftVersion}/${element}/${version}
            fi

            if [ ! -d "${OUTPUT_DIR}" ]; then
                # Create the output directory if it doesn't already exist
                mkdir -p ${OUTPUT_DIR}
            fi

            command="node bin/compile --schema ${CURRENT_SCHEMA_DIR}/${element}.json --schema-dir ${CURRENT_SCHEMA_DIR} --output ${OUTPUT_DIR}/index.json --draft-version ${draftVersion}"
            echo ${command} # Echo command so it's easy to debug
            eval ${command}
        done
    done
done

echo "All compilations complete"
