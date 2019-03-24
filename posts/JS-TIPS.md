---
title: Javascript Tips
updated: 2019-02-24
layout: 2017/sheet
---

### toString

```
var value = [{}];

Array.prototype.toString.call(value);
> '[object Object]'

Object.prototype.toString.call(value);
> '[object Array]'

value.toString();
> '[object Object]'

**结论：** Array对象[重写](https://stackoverflow.com/questions/33769155/array-prototype-tostring-vs-object-tostring)了Object的toString()方法。
```

### ES6 constant and variable

```
只有当页面重新加载时才会重新赋值。
如在某模块定义:
const value = localStorage.getItem('key_of_school');
当你在页面其他操作设置localStorage时，不刷新页面value的值是不会改变的。
一个解决办法是通过函数调用，或放进类中等方法动态获取。
```

### get element position

```
function _getOffset(element) {
  let body = document.body;
  let docEl = document.documentElement;
  let scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
  let scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;
  let x = element.getBoundingClientRect();
  return {
    top: x.top + scrollTop,
    width: x.width,
    height: x.height,
    left: x.left + scrollLeft
  };
}
```

### element attribute

```
获取DOM element的css属性对象
CSSStyleDeclaration declaration = document.defaultView.getComputedStyle(element, null)
根据css属性名获取属性值
declaration.getPropertyValue('position');

IE兼容办法
if (element.currentStyle) {
  propValue = element.currentStyle[propName];
}
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
