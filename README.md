<a href="https://schemas.getpostman.com" target="_blank"><img src="https://s3.amazonaws.com/web-artefacts/postman-logo%2Btext-197x68.png" /></a>

# Postman Schemas

Repository of all schemas for JSON structures compatible with Postman (such as the Postman Collection Format). The schemas are also hosted online, at [schema.getpostman.com](https://schema.getpostman.com). 

## Schema Viewer

This repository ships a [TanStack Start](https://tanstack.com/start) (React) app that renders every schema version using the [Stoplight JSON Schema Viewer](https://github.com/stoplightio/json-schema-viewer).

Requirements: Node.js `24` (see `.nvmrc`) and [pnpm](https://pnpm.io).

```
nvm use            # switch to Node 24
pnpm install       # install dependencies
pnpm dev           # start the dev server at http://localhost:3000
pnpm build         # production build
pnpm start         # serve the production build
pnpm run preview:cf  # build for Cloudflare Workers and serve it with wrangler dev
pnpm run deploy      # build for Cloudflare Workers and deploy the "schemas" Worker
```

Use `pnpm run deploy`, not `pnpm deploy`: pnpm 10's built-in `deploy` command takes precedence over the script.

Each schema under `schemas/<draft>/<version>/` is compiled into a single document (sibling definitions merged, `$ref`s kept, not dereferenced) by `pnpm generate:schemas` (run automatically before `dev`/`build`), which reuses the tooling in `lib/`. The compiled output and a manifest are written to `src/generated/` (git-ignored).

The underlying schema tooling is still available directly:

```
pnpm compile --schema <file> --schema-dir <dir> --output <file>
pnpm validate --input <file> --schema <file> --schema-dir <dir>
```

## Usage

All the schemas in this repository are valid JSON Schemas, compliant with the [JSON-Schema, Draft 4](http://json-schema.org/documentation.html). As such, they can be used with a number of tools to validate arbitrary JSON blobs, as show below: 

### Examples: JavaScript

#### [is-my-json-valid](https://github.com/mafintosh/is-my-json-valid)

```
var https = require('https'),
    validate = require('is-my-json-valid');

var input = {
    /* JSON of a collection V1 */
};

// we fetch the schema from server and when it is received, 
// validate our input JSON against it.
https.get('https://schema.getpostman.com/json/collection/v1/', function (response) {
    var body = '';

    response.on('data', function (d) {
        body += d;
    });

    response.on('end', function () {
        var validate = validator(JSON.parse(body));
        console.log(validate(input) ? 'It is a valid collection!' : 'It is not a valid collection!');
    });
});
```

#### [tv4](https://github.com/geraintluff/tv4)
```
var https = require('https'),
    tv4 = require('tv4');

var input = {
    /* JSON of a collection V1 */
};

// we fetch the schema from server and when it is received,
// validate our input JSON against it.
https.get('https://schema.getpostman.com/json/collection/v1/', function (response) {
    var body = '';

    response.on('data', function (d) {
        body += d;
    });

    response.on('end', function () {
        var result = tv4.validate(input, JSON.parse(body));
        console.log((result) ? 'It is a valid collection!' : 'It is not a valid collection!');
    });
});
```

### Example: Python

#### [jsonschema](https://github.com/Julian/jsonschema)

```
import requests  # make sure this is installed
from jsonschema import validate
from jsonschema.exceptions import ValidationError

schema = requests.get('https://schema.getpostman.com/json/collection/v1/').json()

test_input = {}  # Whatever needs to be validated.

try:
    validate(test_input, schema)
except ValidationError:
    print 'It is not a valid collection!'
else:
    print 'It is a valid collection!'
```
