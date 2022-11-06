# poe-dat-export

![NPM Version](https://img.shields.io/npm/v/npm) ![LICENSE](https://img.shields.io/github/license/moepmoep12/poe-dat-export) ![TOP LANGUAGE](https://img.shields.io/github/languages/top/moepmoep12/poe-dat-export) ![ISSUES](https://img.shields.io/github/issues/moepmoep12/poe-dat-export)

## Table of Contents

- [Introduction](#introduction)
- [Overview](#overview)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Debug](#debug)
- [Related projects](#related-projects)

## Introduction

The purpose of this library is to provide developers a way to extract table data from the game [Path of Exile](https://www.pathofexile.com/) (PoE) by Grinding Gear Games.
This library originated from [poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer) by [SnosMe](<[https://](https://github.com/SnosMe)>).

> Note: This product isn't affiliated with or endorsed by Grinding Gear Games in any way.

## Overview

The key objectives of this library are:

- Provide API for extracting game data as tables
- Support all languages

## Installation

Install the latest stable version of this library:

```bash
 npm install --save poe-dat-export
```

## Getting started

```typescript
import { Exporter, Loaders, Language } from "poe-dat-export";

const loader = new Loaders.OnlineBundleLoader({});

const exporter = new Exporter.DatExporter({
  bundleLoader: loader,
});

try {
  const result = await exporter.export("CurrencyItems", Language.German);
  console.log(result[0]);
} catch (error) {
  // error handling
}

/**
 * Prints: 
{
  _index: 0,
  BaseItemTypesKey: 4,
  Stacks: 40,
  CurrencyUseType: 2,
  Action: 'add_armour_quality',
  FullStack_BaseItemTypesKey: 18374403900871475000,
  ShopTag: 18374403900871475000,
  etc.
}
 */
```

## Debug

Debug information can be displayed by setting the `DEBUG` environment variable. In order to display debug information of all modules add `poe-dat:*` to `DEBUG`. Multiple entries are separated by comma or space.
For example, to only show debug information of the `DatExporter` set `DEBUG=poe-dat:DatExporter`.
For more information refer to the [debug library](<[https://](https://github.com/debug-js/debug)>).

## Related projects

- [poe-dat-viewer](https://github.com/SnosMe/poe-dat-viewer)
- [dat-schema](https://github.com/poe-tool-dev/dat-schema)
- [RePoE](https://github.com/brather1ng/RePoE)
