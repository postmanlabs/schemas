#!/bin/bash

set -e

echo "Compiling schemas, working directory is: " $PWD

ALL_SCHEMA_DIR=$PWD/schemas
COMPILED_SCHEMA_DIR=$PWD/compiled-schemas/json/collection

echo "Schema directory is: " ${ALL_SCHEMA_DIR}

for versionDir in schemas/*; do
    [ -d ${versionDir} ] || continue # if not a directory, skip
    version=$(basename ${versionDir})
    echo "----- Compiling Version [${version}] -----"
    CURRENT_SCHEMA_DIR=${ALL_SCHEMA_DIR}/${version}
    OUTPUT_DIR=${COMPILED_SCHEMA_DIR}/${version}

    if [ ! -d "${OUTPUT_DIR}" ]; then
        # Create the output directory if it doesn't already exist
        mkdir -p ${OUTPUT_DIR}
    fi

    command="node bin/compile --schema ${CURRENT_SCHEMA_DIR}/collection.json --schema-dir ${CURRENT_SCHEMA_DIR} --output ${OUTPUT_DIR}/index.json"
    echo ${command} # Echo command so it's easy to debug
    eval ${command}
done

echo "All compilations complete"
