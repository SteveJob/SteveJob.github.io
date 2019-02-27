---
title: React Fiber Reconciler
updated: 2019-02-27
layout: 2017/blog
intro: 对比React两种调度方法实现，找出可以学习的架构设计知识。
---

### babel-plugin-transform-runtime

>查找regeneratorRuntime：

```
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

| Code                       | Description                       |
| -------------------------- | --------------------------------- |
| `401 Unauthorized`         | Not authenticated                 |
| `403 Forbidden`            | Authenticated, but no permissions |
| `422 Unprocessable entity` | Validation                        |


```
HTTP/1.1 401 Unauthorized
Content-Type: application/json
{
  'id': 'auth_failed',
  'message': "You're not logged in."
}
```

Here's an example of a possible error reply.


```
GET /api/foo
Accept: application/json; version=1
```

You can pass a `version=x` to the Accept request header. [Info here](https://github.com/interagent/http-api-design#version-with-accepts-header)

* [interagent/http-api-design](https://github.com/interagent/http-api-design) _(github.com)_
