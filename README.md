<a href="https://schemas.getpostman.com" target="_blank"><img src="https://s3.amazonaws.com/web-artefacts/postman-logo%2Btext-197x68.png" /></a>

# Postman Schemas

Repository of all schemas for JSON structures compatible with Postman (such as the Postman Collection Format). The schemas are also hosted online, at [schema.getpostman.com](https://schema.getpostman.com). 

## Usage

All the schemas in this repository are valid JSON Schemas, compliant with the [JSON-Schema, Draft 7](https://json-schema.org/specification-links.html#draft-7). As such, they can be used with a number of tools to validate arbitrary JSON blobs, as show below: 

### Examples: JavaScript

#### [is-my-json-valid](https://github.com/mafintosh/is-my-json-valid)

```javascript
var https = require('https'),
    validator = require('is-my-json-valid');

var input = {
    /* JSON of a collection V2.1.0 */
};

// we fetch the schema from server and when it is received, 
// validate our input JSON against it.
https.get('https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json', function (response) {
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

### Example: Python

#### [jsonschema](https://github.com/python-jsonschema/jsonschema)

```python
from jsonschema import Draft7Validator

SCHEMA_URL = "https://schema.postman.com/collection/json/v2.1.0/draft-07/collection.json"
validator = Draft7Validator(schema={"$ref": SCHEMA_URL})

test_input = {}  # Whatever needs to be validated.

if validator.is_valid(test_input):
    print("It is a valid collection!")
else:
    print("It is not a valid collection!")
```
