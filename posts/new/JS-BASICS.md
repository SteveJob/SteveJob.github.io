---
title: Javascript Basics
updated: 2019-02-24
layout: 2017/sheet
---

### iterator

javascript的Iterable接口是指Array、Map、Set、String、TypedArray、arguments、NodeList这些原生类上实现了**Symbol.iterator()**方法。当这些类的实例调用**Symbol.iterator()**方法时，会得到一个**Iterator**，又叫遍历器，通过这个遍历器，你可以遍历整个数据结构的值。

```ts
interface Iterable {
  [Symbol.iterator]() : Iterator,
}

interface Iterator {
  next(value?: any) : IterationResult,
}

interface IterationResult {
  value: any,
  done: boolean,
}
```

### Status codes

```js
①element.clientHeight/element.clientWidth

②
element.scrollTop/element.scrollLeft（自身元素滚动距离）
element.offsetTop/element.offsetLeft（相对父元素offsetParent的偏移）

③
element.scrollHeight/element.scrollWidth（自身元素真实宽高度）
element.offsetHeight/element.offsetWidth（自身元素真实宽高度）

① + ② = ③
```


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
