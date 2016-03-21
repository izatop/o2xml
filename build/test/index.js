/// <reference path="../../typings/tsd.d.ts" />
"use strict";
var index_1 = require("../index");
var assert = require('assert');
var sourceMapSupport = require('source-map-support');
sourceMapSupport.install();
var ISOString = '2016-03-18T09:56:27.906Z';
describe('Common', function () {
    it('An object should contain one root element', function () {
        assert.throws(function () { return index_1.transform({ foo: null, bar: null }); });
    });
    it('A root element should not be a list', function () {
        assert.throws(function () { return index_1.transform({ foo: [] }); });
    });
    it('Empty elements should be self-close', function () {
        assert.equal(index_1.transform({ foo: {} }), '<foo />');
        assert.equal(index_1.transform({ bar: null }), '<bar />');
    });
    it('The Array of objects should be converted to a list of nodes', function () {
        assert.equal(index_1.transform({ foo: { bar: [{ foo: null }, { bar: null }] } }), '<foo><bar><foo /></bar><bar><bar /></bar></foo>');
    });
    it('The XML declaration should be written when needed', function () {
        assert.equal(index_1.transform({ foo: null }, { declaration: true }), '<?xml version="1.0" encoding="UTF-8" ?><foo />');
    });
});
describe('Validate tag names', function () {
    it('A root element name should be valid', function () {
        var numberKey = 1, objectKey = {}, nullKey = null;
        assert.throws(function () { return index_1.transform((_a = {}, _a[numberKey] = null, _a)); var _a; });
        assert.throws(function () { return index_1.transform((_a = {}, _a[objectKey] = null, _a)); var _a; });
        assert.throws(function () { return index_1.transform((_a = {}, _a[nullKey] = null, _a)); var _a; });
    });
    it('An element name should be valid', function () {
        assert.throws(function () { return index_1.transform({ foo: { '1foo': null } }); });
        assert.throws(function () { return index_1.transform({ foo: { 'ns:1foo': null } }); });
        assert.throws(function () { return index_1.transform({ foo: { null: null } }); });
        assert.doesNotThrow(function () { return index_1.transform({ foo: { 'ns:foo': null } }); });
        assert.doesNotThrow(function () { return index_1.transform({ foo: { ':foo': null } }); });
        assert.doesNotThrow(function () { return index_1.transform({ foo: { 'foo-bar': null } }); });
        assert.doesNotThrow(function () { return index_1.transform({ foo: { 'foo:bar-foo': null } }); });
    });
    it('Prefix namespaces should work', function () {
        assert.equal(index_1.transform({ 'foo:bar': null }), '<foo:bar />');
        assert.equal(index_1.transform({ ':bar': null }), '<bar />');
    });
});
describe('Converting objects', function () {
    it('Dates should be converted to ISO string', function () {
        assert.equal(index_1.transform({ foo: new Date(ISOString) }), '<foo>' + ISOString + '</foo>');
    });
    it('Boolean should be convert true to 1 and false to 0', function () {
        assert.equal(index_1.transform({ foo: true }), '<foo>1</foo>');
        assert.equal(index_1.transform({ foo: false }), '<foo>0</foo>');
    });
    it('Buffer should be encoded in base64', function () {
        var png1px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        assert.equal(index_1.transform({ foo: new Buffer(png1px, 'base64') }), '<foo>' + png1px + '</foo>');
        assert.equal(index_1.transform({ foo: { '@bar': new Buffer(png1px, 'base64') } }), '<foo bar="' + png1px + '" />');
    });
    it('Mixed strings, objects and attributes should be valid', function () {
        var mixed = {
            div: {
                '@title': new Date(ISOString),
                '#text1': 'Hello',
                span: {
                    '@style': 'font-size: 15px',
                    '#text': 'World'
                },
                '#text2': '!'
            }
        };
        var resultXML = '<div title="' + ISOString + '">Hello<span style="font-size: 15px">World</span>!</div>';
        assert.equal(index_1.transform(mixed), resultXML);
    });
    it('Objects can be deep', function () {
        var deepObject = {
            foo: {
                '@bar': 1,
                '@foo': null,
                bar: {
                    foo: {
                        foo: {
                            '@foo': 1,
                            '#text': 'Hello'
                        },
                        bar: {
                            foo: 1234567890
                        }
                    }
                }
            }
        };
        var resultXML = '<foo bar="1" foo=""><bar><foo><foo foo="1">Hello</foo><bar><foo>1234567890</foo></bar></foo></bar></foo>';
        assert.equal(index_1.transform(deepObject), resultXML);
    });
});
describe('Attributes', function () {
    it('Attributes should start with @', function () {
        assert.equal(index_1.transform({ foo: { '@bar': null } }), '<foo bar="" />');
    });
    it('Invalid attributes should thrown an exception', function () {
        assert.throws(function () { return index_1.transform({ foo: { '@1': null } }); });
        assert.throws(function () { return index_1.transform({ foo: { '@foo': Function } }); });
        assert.throws(function () { return index_1.transform({ foo: { '@foo': Object } }); });
    });
});
//# sourceMappingURL=index.js.map