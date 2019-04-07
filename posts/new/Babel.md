---
title: Babel技术
updated: 2010-02-26
layout: 2017/sheet
intro: 我的babel心得
---

### Async-Await

```
Async-Await

ES8语法
```

### babel-plugin-transform-runtime

```
>查找regeneratorRuntime：
ReferencedIdentifier(path) {
  const { node, parent, scope } = path;
  if (node.name === "regeneratorRuntime" && useRuntimeRegenerator) {
    path.replaceWith(
      this.addDefaultImport(
        `${modulePath}/regenerator`,
        "regeneratorRuntime",
      ),
    );
    return;
  }

  if (!injectCoreJS2) return;

  if (t.isMemberExpression(parent)) return;
  if (!has(definitions.builtins, node.name)) return;
  if (scope.getBindingIdentifier(node.name)) return;

  // Symbol() -> _core.Symbol(); new Promise -> new _core.Promise
  path.replaceWith(
    this.addDefaultImport(
      `${modulePath}/core-js/${definitions.builtins[node.name]}`,
      node.name,
    ),
  );
}

依赖babel-runtime
this.addDefaultImport(
  `${modulePath}/regenerator`,
  "regeneratorRuntime",
)

addDefaultImport依赖babel-helper-module-imports
协助导入import regeneratorRuntime from '@babel/runtime/regenerator'

babel-runtime/regenerator依赖regenerator-runtime
module.exports = require("regenerator-runtime");

regenerator-runtime是facebook开源的facebook/regenerator：
Standalone runtime for Regenerator-compiled generator and async functions.

ES8语法
```

### Error status

| Code                       | Description                       |
| -------------------------- | --------------------------------- |
| `401 Unauthorized`         | Not authenticated                 |
| `403 Forbidden`            | Authenticated, but no permissions |
| `422 Unprocessable entity` | Validation                        |

### Errors

```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
{
  'id': 'auth_failed',
  'message': "You're not logged in."
}
```

Here's an example of a possible error reply.

### Versioning

```
GET /api/foo
Accept: application/json; version=1
```

You can pass a `version=x` to the Accept request header. [Info here](https://github.com/interagent/http-api-design#version-with-accepts-header)

### Authentication

```
curl -is https://$TOKEN@api.service.com/
```

### Methods

| Request              | Description                   |
| -------------------- | ----------------------------- |
| `GET /articles/1`    | read, returns _200_           |
| `PUT /articles/1`    | edit (or path), returns _200_ |
| `DELETE /articles/1` | delete, returns _200_         |
| `POST /articles`     | create, returns _201_         |
| `GET /articles`      | list, returns _200_           |

### References

* [interagent/http-api-design](https://github.com/interagent/http-api-design) _(github.com)_
