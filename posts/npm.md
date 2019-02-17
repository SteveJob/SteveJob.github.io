---
title: npm
category: JavaScript
layout: 2017/sheet
weight: -1
updated: 2017-10-27
---

### Package management

| Command                           | Description                        |
| ---                               | ---                                |
| `npm i`                           | Alias for `npm install`            |
| `npm install`                     | Install everything in package.json |
| ---                               | ---                                |
| `npm install lodash`              | Install a package                  |
| `npm install --save-dev lodash`   | Install as devDependency           |
| `npm install --save-exact lodash` | Install with exact                 |

`--save` is the default as of npm@5. Previously, using `npm install` without `--save` doesn't update package.json.

### Install names

| Command                              | Description             |
| ---                                  | ---                     |
| `npm i sax`                          | NPM package             |
| `npm i sax@latest`                   | Specify tag `latest`    |
| `npm i sax@3.0.0`                    | Specify version `3.0.0` |
| `npm i sax@">=1 <2.0"`               | Specify version range   |
| ---                                  | ---                     |
| `npm i @org/sax`                     | Scoped NPM package      |
| ---                                  | ---                     |
| `npm i user/repo`                    | GitHub                  |
| `npm i user/repo#master`             | GitHub                  |
| `npm i github:user/repo`             | GitHub                  |
| `npm i gitlab:user/repo`             | GitLab                  |
| ---                                  | ---                     |
| `npm i /path/to/repo`                | Absolute path           |
| `npm i ./archive.tgz`                | Tarball                 |
| `npm i https://site.com/archive.tgz` | Tarball via HTTP        |

### Updating

| Command             | Description                |
| ---                 | ---                        |
| `npm update`        | Update production packages |
| `npm update --dev`  | Update dev packages        |
| `npm update -g`     | Update global packages     |
| ---                 | ---                        |
| `npm update lodash` | Update a package           |


### Misc features

```bash
# Add someone as an owner
npm owner add USERNAME PACKAGENAME
```

```bash
# list packages
npm ls
```

```bash
# Adds warning to those that install a package of old versions
npm deprecate PACKAGE@"< 0.2.0" "critical bug fixed in v0.2.0"
```

```bash
# update all packages, or selected packages
npm update [-g] PACKAGE
```

```bash
# Check for outdated packages
npm outdated [PACKAGE]
```
