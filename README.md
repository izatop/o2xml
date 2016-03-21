# o2xml
Simple object to XML converter.

## Install

`npm install o2xml`

## Simple example

```js
var o2xml = require('o2xml');
var object = {
    thing: {
        '@flag': true,
        '@number': 123,
        '@date': new Date(),
        items: {
            '@length': 2,
            item: [
                {name: 'Alexander', birth: new Date('2002-12-09')},
                {name: 'Daniel', birth: new Date('1991-03-22')}
            ]
        }
    }
}

console.log(o2xml.transform(object, {pretty: true}));
```

converts to:

```xml
<thing flag="1" number="123" date="2016-03-18T14:18:00.563Z">
  <items length="2">
    <item>
      <name>Alexander</name>
      <birth>2002-12-09T00:00:00.000Z</birth>
    </item>
    <item>
      <name>Daniel</name>
      <birth>1991-03-22T00:00:00.000Z</birth>
    </item>
  </items>
</thing>
```

## Options

 - pretty: `true|false` make pretty XML (default: `false`).
 - indent: `\t` spacing (default: two spaces).
 - declaration: `true` write the XML declaration (default: `false`).
 - formatters: `{string:fn, boolean:fn, number:fn, date:fn}` format and escape functions.

## Mix strings, nodes and attributes

```js
var o2xml = require('o2xml');
var object = {
    div: {
        '@id': 'id',
        '#text': 'Hello, ',
        span: {
            '@style': 'font-weight: bold',
            '#text': 'World'
        },
        '#text2': '!'
    }
}

console.log(o2xml.transform(object));
```

converts to:

```xml
<div id="id">Hello, <span style="font-weight: bold">World</span>!</div>
```

## Note

 - Text escape by default (amp, quote, single quote, left/right angle brackets).
 - Node.js Buffer will be converted to base64 encoded string.
 - String nodes must start with `#` and key must be unique in space.