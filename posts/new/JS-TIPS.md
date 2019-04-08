---
title: Javascript Tips
updated: 2018-01-11
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
如在 ES6 模块定义:
const value = localStorage.getItem('key_of_school');
当你在页面其他操作设置 localStorage 时，不刷新页面 value 的值是不会改变的。
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
获取DOM element 的 css 属性对象
CSSStyleDeclaration declaration = document.defaultView.getComputedStyle(element, null)
根据 css 属性名获取属性值
declaration.getPropertyValue('position');

IE兼容办法
if (element.currentStyle) {
  propValue = element.currentStyle[propName];
}
```
