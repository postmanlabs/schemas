import { isLocalRef, pathToPointer, extractSourceFromRef, extractPointerFromRef, resolveInlineRef } from '@stoplight/json';
import { EventEmitter } from '@stoplight/lifecycle';
import createMagicError from 'magic-error';
// Fork change: the upstream compiled bundle uses a CommonJS `require` for this
// dependency inside an ESM file, which breaks native ESM / worker bundling. Use a
// static import instead. The default export is the merge function and it also
// carries the `stoplightResolvers` property, so behavior is identical.
import resolveAllOf from '@stoplight/json-schema-merge-allof';

let SEED = BigInt(0);
class BaseNode {
    constructor() {
        this.parent = null;
        this.id = String(SEED++);
        this.subpath = [];
    }
    get path() {
        return this.parent === null ? this.subpath : [...this.parent.path, ...this.subpath];
    }
    get depth() {
        return this.parent === null ? 0 : this.parent.depth + 1;
    }
    get parentChildren() {
        var _a, _b;
        return ((_b = (_a = this.parent) === null || _a === void 0 ? void 0 : _a.children) !== null && _b !== void 0 ? _b : []);
    }
    get pos() {
        return Math.max(0, this.parentChildren.indexOf(this));
    }
    get isFirst() {
        return this.pos === 0;
    }
    get isLast() {
        return this.pos === this.parentChildren.length - 1;
    }
}

class BooleanishNode extends BaseNode {
    constructor(fragment) {
        super();
        this.fragment = fragment;
    }
}

class MirroredReferenceNode extends BaseNode {
    constructor(mirroredNode) {
        super();
        this.mirroredNode = mirroredNode;
        this.fragment = mirroredNode.fragment;
    }
    get error() {
        return this.mirroredNode.error;
    }
    get value() {
        return this.mirroredNode.value;
    }
    get external() {
        return this.mirroredNode.external;
    }
}

function isStringOrNumber(value) {
    return typeof value === 'string' || typeof value === 'number';
}
function isObject(maybeObj) {
    return maybeObj !== void 0 && maybeObj !== null && typeof maybeObj === 'object';
}
function isPrimitive(maybePrimitive) {
    return typeof maybePrimitive !== 'function' && !isObject(maybePrimitive);
}
function isObjectLiteral(maybeObj) {
    if (isPrimitive(maybeObj) === true)
        return false;
    const proto = Object.getPrototypeOf(maybeObj);
    return proto === null || proto === Object.prototype;
}
function isNonNullable(maybeNullable) {
    return maybeNullable !== void 0 && maybeNullable !== null;
}
function isValidSchemaFragment(maybeSchemaFragment) {
    return typeof maybeSchemaFragment === 'boolean' || isObjectLiteral(maybeSchemaFragment);
}

function pick(target, keys) {
    const source = {};
    for (const key of keys) {
        if (key in target) {
            source[key] = target[key];
        }
    }
    return source;
}

class MirroredRegularNode extends BaseNode {
    constructor(mirroredNode, context) {
        var _a;
        super();
        this.mirroredNode = mirroredNode;
        this.fragment = mirroredNode.fragment;
        this.originalFragment = (_a = context === null || context === void 0 ? void 0 : context.originalFragment) !== null && _a !== void 0 ? _a : mirroredNode.originalFragment;
        this.cache = new WeakMap();
        this._this = new Proxy(this, {
            get(target, key) {
                if (key in target) {
                    return target[key];
                }
                if (key in mirroredNode) {
                    return Reflect.get(mirroredNode, key, mirroredNode);
                }
                return;
            },
            has(target, key) {
                return key in target || key in mirroredNode;
            },
        });
        return this._this;
    }
    get children() {
        const referencedChildren = this.mirroredNode.children;
        if (!isNonNullable(referencedChildren)) {
            return referencedChildren;
        }
        if (this._children === void 0) {
            this._children = [];
        }
        else {
            this._children.length = 0;
        }
        const children = this._children;
        for (const child of referencedChildren) {
            const cached = this.cache.get(child);
            if (cached !== void 0) {
                children.push(cached);
                continue;
            }
            const mirroredChild = isRegularNode(child)
                ? new MirroredRegularNode(child)
                : isReferenceNode(child)
                    ? new MirroredReferenceNode(child)
                    : new BooleanishNode(child.fragment);
            mirroredChild.parent = this._this;
            mirroredChild.subpath = child.subpath;
            this.cache.set(child, mirroredChild);
            children.push(mirroredChild);
        }
        return children;
    }
}

function unwrapStringOrNull(value) {
    return typeof value === 'string' ? value : null;
}
function unwrapArrayOrNull(value) {
    return Array.isArray(value) ? value : null;
}

class ReferenceNode extends BaseNode {
    constructor(fragment, error) {
        super();
        this.fragment = fragment;
        this.error = error;
        this.value = unwrapStringOrNull(fragment.$ref);
    }
    get external() {
        return this.value !== null && !isLocalRef(this.value);
    }
}

const ANNOTATIONS = ['description', 'default', 'examples'];
function getAnnotations(fragment) {
    const annotations = pick(fragment, ANNOTATIONS);
    if ('example' in fragment && !Array.isArray(annotations.examples)) {
        annotations.examples = [fragment.example];
    }
    return annotations;
}

var SchemaNodeKind;
(function (SchemaNodeKind) {
    SchemaNodeKind["Any"] = "any";
    SchemaNodeKind["String"] = "string";
    SchemaNodeKind["Number"] = "number";
    SchemaNodeKind["Integer"] = "integer";
    SchemaNodeKind["Boolean"] = "boolean";
    SchemaNodeKind["Null"] = "null";
    SchemaNodeKind["Array"] = "array";
    SchemaNodeKind["Object"] = "object";
})(SchemaNodeKind || (SchemaNodeKind = {}));
var SchemaCombinerName;
(function (SchemaCombinerName) {
    SchemaCombinerName["AllOf"] = "allOf";
    SchemaCombinerName["AnyOf"] = "anyOf";
    SchemaCombinerName["OneOf"] = "oneOf";
})(SchemaCombinerName || (SchemaCombinerName = {}));

function getCombiners(fragment) {
    let combiners = null;
    if (SchemaCombinerName.AnyOf in fragment) {
        combiners !== null && combiners !== void 0 ? combiners : (combiners = []);
        combiners.push(SchemaCombinerName.AnyOf);
    }
    if (SchemaCombinerName.OneOf in fragment) {
        combiners !== null && combiners !== void 0 ? combiners : (combiners = []);
        combiners.push(SchemaCombinerName.OneOf);
    }
    if (SchemaCombinerName.AllOf in fragment) {
        combiners !== null && combiners !== void 0 ? combiners : (combiners = []);
        combiners.push(SchemaCombinerName.AllOf);
    }
    return combiners;
}

function getPrimaryType(fragment, types) {
    if (types !== null) {
        if (types.includes(SchemaNodeKind.Object)) {
            return SchemaNodeKind.Object;
        }
        if (types.includes(SchemaNodeKind.Array)) {
            return SchemaNodeKind.Array;
        }
        if (types.length > 0) {
            return types[0];
        }
        return null;
    }
    return null;
}

function getRequired(required) {
    if (!Array.isArray(required))
        return null;
    return required.filter(isStringOrNumber).map(String);
}

const VALID_TYPES = Object.values(SchemaNodeKind);
const isValidType = (maybeType) => typeof maybeType === 'string' && VALID_TYPES.includes(maybeType);

function inferType(fragment) {
    if ('properties' in fragment || 'additionalProperties' in fragment || 'patternProperties' in fragment) {
        return SchemaNodeKind.Object;
    }
    if ('items' in fragment || 'additionalItems' in fragment) {
        return SchemaNodeKind.Array;
    }
    return null;
}

function getTypes(fragment) {
    const types = [];
    let isNullable = false;
    if ('nullable' in fragment) {
        if (fragment.nullable === true) {
            isNullable = true;
        }
    }
    if ('type' in fragment) {
        if (Array.isArray(fragment.type)) {
            types.push(...fragment.type.filter(isValidType));
        }
        else if (isValidType(fragment.type)) {
            types.push(fragment.type);
        }
        if (isNullable && !types.includes(SchemaNodeKind.Null)) {
            types.push(SchemaNodeKind.Null);
        }
        return types;
    }
    const inferredType = inferType(fragment);
    if (inferredType !== null) {
        types.push(inferredType);
        if (isNullable && !types.includes(SchemaNodeKind.Null)) {
            types.push(SchemaNodeKind.Null);
        }
        return types;
    }
    return null;
}

const COMMON_VALIDATION_TYPES = ['readOnly', 'writeOnly', 'style'];
const VALIDATION_TYPES = {
    string: ['minLength', 'maxLength', 'pattern'],
    number: ['multipleOf', 'minimum', 'exclusiveMinimum', 'maximum', 'exclusiveMaximum'],
    get integer() {
        return this.number;
    },
    object: ['minProperties', 'maxProperties'],
    array: ['minItems', 'maxItems', 'uniqueItems'],
};
function getTypeValidations(types) {
    let extraValidations = null;
    for (const type of types) {
        const value = VALIDATION_TYPES[type];
        if (value !== void 0) {
            extraValidations !== null && extraValidations !== void 0 ? extraValidations : (extraValidations = []);
            extraValidations.push(...value);
        }
    }
    return extraValidations;
}
function getValidations(fragment, types) {
    const extraValidations = types === null ? null : getTypeValidations(types);
    return {
        ...pick(fragment, COMMON_VALIDATION_TYPES),
        ...(extraValidations !== null ? pick(fragment, extraValidations) : null),
    };
}

function isDeprecated(fragment) {
    if ('x-deprecated' in fragment) {
        return fragment['x-deprecated'] === true;
    }
    if ('deprecated' in fragment) {
        return fragment.deprecated === true;
    }
    return false;
}

class RegularNode extends BaseNode {
    constructor(fragment, context) {
        var _a;
        super();
        this.fragment = fragment;
        this.$id = unwrapStringOrNull('id' in fragment ? fragment.id : fragment.$id);
        this.types = getTypes(fragment);
        this.primaryType = getPrimaryType(fragment, this.types);
        this.combiners = getCombiners(fragment);
        this.deprecated = isDeprecated(fragment);
        this.enum = 'const' in fragment ? [fragment.const] : unwrapArrayOrNull(fragment.enum);
        this.required = getRequired(fragment.required);
        this.format = unwrapStringOrNull(fragment.format);
        this.title = unwrapStringOrNull(fragment.title);
        this.annotations = getAnnotations(fragment);
        this.validations = getValidations(fragment, this.types);
        this.originalFragment = (_a = context === null || context === void 0 ? void 0 : context.originalFragment) !== null && _a !== void 0 ? _a : fragment;
        this.children = void 0;
    }
    get simple() {
        return (this.primaryType !== SchemaNodeKind.Array && this.primaryType !== SchemaNodeKind.Object && this.combiners === null);
    }
    get unknown() {
        return (this.types === null &&
            this.combiners === null &&
            this.format === null &&
            this.enum === null &&
            Object.keys(this.annotations).length + Object.keys(this.validations).length === 0);
    }
}

class RootNode extends BaseNode {
    constructor(fragment) {
        super();
        this.fragment = fragment;
        this.parent = null;
        this.children = [];
    }
}

function isSchemaNode(node) {
    const name = Object.getPrototypeOf(node).constructor.name;
    return (name === RootNode.name ||
        name === RegularNode.name ||
        name === MirroredRegularNode.name ||
        name === ReferenceNode.name ||
        name === MirroredReferenceNode.name);
}
function isRootNode(node) {
    return Object.getPrototypeOf(node).constructor.name === 'RootNode';
}
function isRegularNode(node) {
    return 'types' in node && 'primaryType' in node && 'combiners' in node;
}
function isMirroredNode(node) {
    return 'mirroredNode' in node;
}
function isReferenceNode(node) {
    return 'external' in node && 'value' in node;
}
function isBooleanishNode(node) {
    return typeof node.fragment === 'boolean';
}

class ResolvingError extends ReferenceError {
    constructor() {
        super(...arguments);
        this.name = 'ResolvingError';
    }
}
class MergingError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'MergingError';
    }
}

const store = new WeakMap();
function _mergeAllOf(fragment, path, resolveRef, seen) {
    const cached = seen.get(fragment);
    if (cached !== void 0) {
        return cached;
    }
    const merged = resolveAllOf(fragment, {
        deep: false,
        resolvers: resolveAllOf.stoplightResolvers,
        ...(resolveRef !== null
            ? {
                $refResolver($ref) {
                    if (typeof $ref !== 'string') {
                        return {};
                    }
                    if (pathToPointer(path).startsWith($ref)) {
                        throw new ResolvingError('Circular reference detected');
                    }
                    const allRefs = store.get(resolveRef);
                    let schemaRefs = allRefs.get(fragment);
                    if (schemaRefs === void 0) {
                        schemaRefs = [$ref];
                        allRefs.set(fragment, schemaRefs);
                    }
                    else if (schemaRefs.includes($ref)) {
                        const resolved = resolveRef(null, $ref);
                        return 'allOf' in resolved ? _mergeAllOf(resolved, path, resolveRef, seen) : resolved;
                    }
                    else {
                        schemaRefs.push($ref);
                    }
                    const resolved = resolveRef(null, $ref);
                    if (Array.isArray(resolved.allOf)) {
                        for (const member of resolved.allOf) {
                            const index = schemaRefs.indexOf(member.$ref);
                            if (typeof member.$ref === 'string' && index !== -1 && index !== schemaRefs.lastIndexOf(member.$ref)) {
                                throw new ResolvingError('Circular reference detected');
                            }
                        }
                    }
                    return resolved;
                },
            }
            : null),
    });
    seen.set(fragment, merged);
    return merged;
}
function mergeAllOf(fragment, path, walkingOptions, seen) {
    if (walkingOptions.resolveRef !== null && !store.has(walkingOptions.resolveRef)) {
        store.set(walkingOptions.resolveRef, new WeakMap());
    }
    let merged = fragment;
    do {
        merged = _mergeAllOf(merged, path, walkingOptions.resolveRef, seen);
    } while ('allOf' in merged);
    return merged;
}

function mergeOneOrAnyOf(fragment, path, walkingOptions, mergedAllOfs) {
    const combiner = SchemaCombinerName.OneOf in fragment ? SchemaCombinerName.OneOf : SchemaCombinerName.AnyOf;
    const items = fragment[combiner];
    if (!Array.isArray(items))
        return [];
    const merged = [];
    if (Array.isArray(fragment.allOf)) {
        for (const item of items) {
            merged.push({
                allOf: [...fragment.allOf, item],
            });
        }
        return merged;
    }
    else {
        const prunedSchema = { ...fragment };
        delete prunedSchema[combiner];
        for (const item of items) {
            if (Object.keys(prunedSchema).length === 0) {
                merged.push(item);
            }
            else {
                merged.push(mergeAllOf({
                    allOf: [prunedSchema, item],
                }, path, walkingOptions, mergedAllOfs));
            }
        }
    }
    return merged;
}

// Fork change: upstream builds a multi-branch oneOf/anyOf node from the combiner
// alone, so a titled union loses its title and description. We copy the
// combiner's display annotations back onto it, and only those. mergeOneOrAnyOf
// has already merged every sibling keyword into each branch, so copying
// structural keywords (type, properties, items, required, ...) onto the combiner
// as well would make the walker emit phantom non-branch children and change the
// node's types and validations.
const COMBINER_ANNOTATION_KEYS = [
    'title',
    'description',
    'default',
    'examples',
    'example',
    'deprecated',
    'readOnly',
    'writeOnly',
    '$comment',
];
function pickCombinerAnnotations(fragment) {
    const annotations = {};
    for (const key of Object.keys(fragment)) {
        if (COMBINER_ANNOTATION_KEYS.includes(key) || key.startsWith('x-')) {
            annotations[key] = fragment[key];
        }
    }
    return annotations;
}

class Walker extends EventEmitter {
    constructor(root, walkingOptions) {
        var _a;
        super();
        this.root = root;
        this.walkingOptions = walkingOptions;
        let maxRefDepth = (_a = walkingOptions.maxRefDepth) !== null && _a !== void 0 ? _a : null;
        if (typeof maxRefDepth === 'number') {
            if (maxRefDepth < 1) {
                maxRefDepth = null;
            }
            else if (maxRefDepth > 1000) {
                maxRefDepth = 1000;
            }
        }
        walkingOptions.maxRefDepth = maxRefDepth;
        this.path = [];
        this.depth = -1;
        this.fragment = root.fragment;
        this.schemaNode = root;
        this.processedFragments = new WeakMap();
        this.mergedAllOfs = new WeakMap();
        this.hooks = {};
    }
    destroy() {
        this.path.length = 0;
        this.depth = -1;
        this.fragment = this.root.fragment;
        this.schemaNode = this.root;
        this.processedFragments = new WeakMap();
        this.mergedAllOfs = new WeakMap();
    }
    loadSnapshot(snapshot) {
        this.path.splice(0, this.path.length, ...snapshot.path);
        this.depth = snapshot.depth;
        this.fragment = snapshot.fragment;
        this.schemaNode = snapshot.schemaNode;
    }
    saveSnapshot() {
        return {
            depth: this.depth,
            fragment: this.fragment,
            schemaNode: this.schemaNode,
            path: this.path.slice(),
        };
    }
    hookInto(action, handler) {
        this.hooks[action] = handler;
    }
    restoreWalkerAtNode(node) {
        this.processedFragments.delete(node.fragment);
        this.path.splice(0, this.path.length, ...node.path);
        this.depth = node.depth;
        this.fragment = node.fragment;
        this.schemaNode = node;
    }
    walk() {
        var _a, _b, _c, _d;
        const { depth: initialDepth, fragment } = this;
        let { schemaNode: initialSchemaNode } = this;
        if (initialDepth === -1 && Object.keys(fragment).length === 0) {
            return;
        }
        while (isMirroredNode(initialSchemaNode)) {
            if (!isRegularNode(initialSchemaNode.mirroredNode)) {
                return;
            }
            if (initialSchemaNode.mirroredNode.children === void 0) {
                this.restoreWalkerAtNode(initialSchemaNode.mirroredNode);
                initialSchemaNode = this.schemaNode;
                this.depth = initialDepth;
            }
            else {
                return;
            }
        }
        const state = this.dumpInternalWalkerState();
        super.emit('enterFragment', fragment);
        const [schemaNode, initialFragment] = this.processFragment();
        super.emit('enterNode', schemaNode);
        const actualNode = isMirroredNode(schemaNode) ? schemaNode.mirroredNode : schemaNode;
        if (typeof schemaNode.fragment !== 'boolean' && initialFragment !== null) {
            this.processedFragments.set(schemaNode.fragment, actualNode);
            this.processedFragments.set(initialFragment, actualNode);
        }
        this.fragment = schemaNode.fragment;
        this.depth = initialDepth + 1;
        if (!isRootNode(schemaNode)) {
            schemaNode.parent = initialSchemaNode;
            schemaNode.subpath = this.path.slice(initialSchemaNode.path.length);
        }
        const isIncluded = (_b = (_a = this.hooks).filter) === null || _b === void 0 ? void 0 : _b.call(_a, schemaNode);
        if (isIncluded === false) {
            super.emit('skipNode', schemaNode);
            return;
        }
        if ('children' in initialSchemaNode && !isRootNode(schemaNode)) {
            if (initialSchemaNode.children === void 0) {
                initialSchemaNode.children = [schemaNode];
            }
            else {
                initialSchemaNode.children.push(schemaNode);
            }
        }
        super.emit('includeNode', schemaNode);
        if (isRegularNode(schemaNode)) {
            this.schemaNode = schemaNode;
            if (((_d = (_c = this.hooks).stepIn) === null || _d === void 0 ? void 0 : _d.call(_c, schemaNode)) !== false) {
                super.emit('stepInNode', schemaNode);
                this.walkNodeChildren();
                super.emit('stepOutNode', schemaNode);
            }
            else {
                super.emit('stepOverNode', schemaNode);
            }
        }
        super.emit('exitNode', schemaNode);
        this.restoreInternalWalkerState(state);
        super.emit('exitFragment', fragment);
    }
    dumpInternalWalkerState() {
        return {
            depth: this.depth,
            pathLength: this.path.length,
            schemaNode: this.schemaNode,
        };
    }
    restoreInternalWalkerState({ depth, pathLength, schemaNode }) {
        this.depth = depth;
        this.path.length = pathLength;
        this.schemaNode = schemaNode;
    }
    walkNodeChildren() {
        const { fragment, schemaNode } = this;
        if (!isRegularNode(schemaNode) || typeof fragment === 'boolean')
            return;
        const state = this.dumpInternalWalkerState();
        if (schemaNode.combiners !== null) {
            for (const combiner of schemaNode.combiners) {
                const items = fragment[combiner];
                if (!Array.isArray(items))
                    continue;
                let i = -1;
                for (const item of items) {
                    i++;
                    if (!isObjectLiteral(item))
                        continue;
                    this.fragment = item;
                    this.restoreInternalWalkerState(state);
                    this.path.push(combiner, String(i));
                    this.walk();
                }
            }
        }
        switch (schemaNode.primaryType) {
            case SchemaNodeKind.Array:
                if (Array.isArray(fragment.items)) {
                    let i = -1;
                    for (const item of fragment.items) {
                        i++;
                        if (!isValidSchemaFragment(item))
                            continue;
                        this.fragment = item;
                        this.restoreInternalWalkerState(state);
                        this.path.push('items', String(i));
                        this.walk();
                    }
                }
                else {
                    if (isObjectLiteral(fragment.items)) {
                        this.fragment = fragment.items;
                        this.restoreInternalWalkerState(state);
                        this.path.push('items');
                        this.walk();
                    }
                    if (isValidSchemaFragment(fragment.additionalItems)) {
                        this.fragment = fragment.additionalItems;
                        this.restoreInternalWalkerState(state);
                        this.path.push('additionalItems');
                        this.walk();
                    }
                }
                break;
            case SchemaNodeKind.Object:
                if (isObjectLiteral(fragment.properties)) {
                    for (const key of Object.keys(fragment.properties)) {
                        const value = fragment.properties[key];
                        if (!isValidSchemaFragment(value))
                            continue;
                        this.fragment = value;
                        this.restoreInternalWalkerState(state);
                        this.path.push('properties', key);
                        this.walk();
                    }
                }
                if (isObjectLiteral(fragment.patternProperties)) {
                    for (const key of Object.keys(fragment.patternProperties)) {
                        const value = fragment.patternProperties[key];
                        if (!isValidSchemaFragment(value))
                            continue;
                        this.fragment = value;
                        this.restoreInternalWalkerState(state);
                        this.path.push('patternProperties', key);
                        this.walk();
                    }
                }
                if (isValidSchemaFragment(fragment.additionalProperties)) {
                    this.fragment = fragment.additionalProperties;
                    this.restoreInternalWalkerState(state);
                    this.path.push('additionalProperties');
                    this.walk();
                }
                break;
        }
        this.schemaNode = schemaNode;
    }
    retrieveFromFragment(fragment, originalFragment) {
        const processedSchemaNode = this.processedFragments.get(fragment);
        if (processedSchemaNode !== void 0) {
            if (isRegularNode(processedSchemaNode)) {
                return [new MirroredRegularNode(processedSchemaNode, { originalFragment }), fragment];
            }
            if (isReferenceNode(processedSchemaNode)) {
                return [new MirroredReferenceNode(processedSchemaNode), fragment];
            }
            throw new TypeError('Cannot mirror the node');
        }
    }
    processFragment() {
        var _a, _b, _c;
        const { walkingOptions, path, fragment: originalFragment, depth } = this;
        let { fragment } = this;
        if (typeof fragment === 'boolean') {
            return [new BooleanishNode(fragment), null];
        }
        if (typeof originalFragment === 'boolean') {
            throw new TypeError('Original fragment cannot be a boolean');
        }
        let retrieved = isNonNullable(fragment) ? this.retrieveFromFragment(fragment, fragment) : null;
        if (retrieved) {
            return retrieved;
        }
        let initialFragment = fragment;
        if ('$ref' in fragment) {
            if (typeof walkingOptions.maxRefDepth === 'number' && walkingOptions.maxRefDepth < depth) {
                return [new ReferenceNode(fragment, `max $ref depth limit reached`), fragment];
            }
            else if (typeof fragment.$ref !== 'string') {
                return [new ReferenceNode(fragment, '$ref is not a string'), fragment];
            }
            else if (walkingOptions.resolveRef !== null) {
                try {
                    let newFragment = walkingOptions.resolveRef(path, fragment.$ref);
                    if (typeof fragment.description === 'string') {
                        newFragment = { ...newFragment };
                        Object.assign(newFragment, { description: fragment.description });
                    }
                    else {
                        retrieved = this.retrieveFromFragment(newFragment, originalFragment);
                        if (retrieved) {
                            return retrieved;
                        }
                    }
                    fragment = newFragment;
                }
                catch (ex) {
                    super.emit('error', createMagicError(ex));
                    return [new ReferenceNode(fragment, (_a = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _a !== void 0 ? _a : 'Unknown resolving error'), fragment];
                }
            }
            else {
                return [new ReferenceNode(fragment, null), fragment];
            }
        }
        if (fragment.type === 'array' && fragment.description === void 0) {
            if (fragment.items !== void 0 && isObjectLiteral(fragment.items)) {
                for (const key of Object.keys(fragment.items)) {
                    if (key === '$ref') {
                        const refToResolve = fragment.items[key];
                        if (typeof refToResolve !== 'string') {
                            return [new ReferenceNode(fragment, '$ref is not a string'), fragment];
                        }
                        else if (walkingOptions.resolveRef !== null) {
                            try {
                                let newFragment = walkingOptions.resolveRef(path, refToResolve);
                                if (newFragment.description !== void 0) {
                                    newFragment = { ...newFragment };
                                    Object.assign(fragment, { description: newFragment.description });
                                }
                            }
                            catch (ex) {
                                super.emit('error', createMagicError(ex));
                            }
                        }
                    }
                }
            }
        }
        if (walkingOptions.mergeAllOf && SchemaCombinerName.AllOf in fragment) {
            try {
                if (Array.isArray(fragment.allOf)) {
                    initialFragment = fragment.allOf;
                }
                fragment = mergeAllOf(fragment, path, walkingOptions, this.mergedAllOfs);
            }
            catch (ex) {
                initialFragment = fragment;
                super.emit('error', createMagicError(new MergingError((_b = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _b !== void 0 ? _b : 'Unknown merging error')));
            }
        }
        if (SchemaCombinerName.OneOf in fragment || SchemaCombinerName.AnyOf in fragment) {
            try {
                const merged = mergeOneOrAnyOf(fragment, path, walkingOptions, this.mergedAllOfs);
                if (merged.length === 1) {
                    return [new RegularNode(merged[0], { originalFragment }), initialFragment];
                }
                else {
                    const combiner = SchemaCombinerName.OneOf in fragment ? SchemaCombinerName.OneOf : SchemaCombinerName.AnyOf;
                    return [new RegularNode({ ...pickCombinerAnnotations(fragment), [combiner]: merged }, { originalFragment }), initialFragment];
                }
            }
            catch (ex) {
                super.emit('error', createMagicError(new MergingError((_c = ex === null || ex === void 0 ? void 0 : ex.message) !== null && _c !== void 0 ? _c : 'Unknown merging error')));
            }
        }
        retrieved = isNonNullable(fragment) ? this.retrieveFromFragment(initialFragment, originalFragment) : null;
        if (retrieved) {
            return retrieved;
        }
        return [new RegularNode(fragment, { originalFragment }), initialFragment];
    }
}

class SchemaTree {
    constructor(schema, opts) {
        var _a;
        this.schema = schema;
        this.opts = opts;
        this.resolvedRefs = new Map();
        this.resolveRef = (path, $ref) => {
            if (this.resolvedRefs.has($ref)) {
                return this.resolvedRefs.get($ref);
            }
            const seenRefs = [];
            let cur$ref = $ref;
            let resolvedValue;
            while (typeof cur$ref === 'string') {
                if (seenRefs.includes(cur$ref)) {
                    break;
                }
                seenRefs.push(cur$ref);
                resolvedValue = this._resolveRef(path, cur$ref);
                cur$ref = resolvedValue.$ref;
            }
            this.resolvedRefs.set($ref, resolvedValue);
            return resolvedValue;
        };
        this._resolveRef = (path, $ref) => {
            var _a;
            const source = extractSourceFromRef($ref);
            const pointer = extractPointerFromRef($ref);
            const refResolver = (_a = this.opts) === null || _a === void 0 ? void 0 : _a.refResolver;
            if (typeof refResolver === 'function') {
                return refResolver({ source, pointer }, path, this.schema);
            }
            else if (source !== null) {
                throw new ResolvingError('Cannot dereference external references');
            }
            else if (pointer === null) {
                throw new ResolvingError('The pointer is empty');
            }
            else if (isObjectLiteral(this.schema)) {
                const value = resolveInlineRef(this.schema, pointer);
                if (!isObjectLiteral(value)) {
                    throw new ResolvingError('Invalid value');
                }
                return value;
            }
            else {
                throw new ResolvingError('Unexpected input');
            }
        };
        this.root = new RootNode(schema);
        this.resolvedRefs = new Map();
        this.walker = new Walker(this.root, {
            mergeAllOf: ((_a = this.opts) === null || _a === void 0 ? void 0 : _a.mergeAllOf) !== false,
            resolveRef: (opts === null || opts === void 0 ? void 0 : opts.refResolver) === null ? null : this.resolveRef,
            maxRefDepth: opts === null || opts === void 0 ? void 0 : opts.maxRefDepth,
        });
    }
    destroy() {
        this.root.children.length = 0;
        this.walker.destroy();
        this.resolvedRefs.clear();
    }
    populate() {
        this.invokeWalker(this.walker);
    }
    invokeWalker(walker) {
        walker.walk();
    }
}

export { BaseNode, BooleanishNode, MirroredReferenceNode, MirroredRegularNode, ReferenceNode, RegularNode, RootNode, SchemaCombinerName, SchemaNodeKind, SchemaTree, isBooleanishNode, isMirroredNode, isReferenceNode, isRegularNode, isRootNode, isSchemaNode };
