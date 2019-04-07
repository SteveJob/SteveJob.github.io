---
title: Javascript 基础
updated: 2019-02-21
layout: 2017/blog
---

## 1.iterator

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

## 2.定义属性Object.defineProperty()

```
// Object {a: 1, b: 2}
Object.defineProperty(o,'c',{
    value:3
});

// Object {a: 1, b: 2, d: 3}
Object.defineProperty(o,'d',{
    configurable:false,
    value:3,
    writable:true,
    readable:true
});

// a,b
for(i in o){
    console.log(i);
}

// Object {a: 1, b: 2, d: 3, e:3}
Object.defineProperty(o,'e',{
    configurable:false,
    value:3,
    writable:true,
    readable:true,
    enumerable:true
});

默认所有配置项皆为false。for-in只会返回可枚举的属性。
```

## 3.检测属性

- for in

检测所有自身和原型链上的可枚举的属性。

```
// true
Object.prototype.a=0;
var o={b:1};
Object.defineProperty(o,'c',{readable:true,value:2})
Object.defineProperty(o,'d',{value:3,enumerable:true})
for(param in o){
    console.log(o[param]);// 1,3,0 无序且没有2
}
// Object.prototype.toString()是不可枚举的，故而不会被打印出来
```

- Object.keys(obj)

返回所有自身可枚举属性。注意与`for in`的区别在于检查不到原型链上的。

- hasOwnProperty()

检测自身属性，包括不可枚举属性。

```
// true
Object.prototype.a=0;
var o={b:1};
Object.defineProperty(o,'c',{value:2})
o.hasOwnProperty('a');// false
o.hasOwnProperty('b');// true
o.hasOwnProperty('c');// true
```

- Object.getOwnPropertyNames(obj)

获取所有自身属性名称数组，包括不可枚举属性。

```
// true
Object.prototype.a=0;
var o={b:1};
Object.defineProperty(o,'c',{value:2})
Object.getOwnPropertyNames(o);// [b,c]
```

- isPropertyEnumerable()

只有当属性属于自身且可枚举时返回true。

```
// true
Object.prototype.a=0;
var o={b:1};
Object.defineProperty(o,'c',{value:2})
o.propertyIsEnumerable('a');// false
o.propertyIsEnumerable('b');// true
o.propertyIsEnumerable('c');// false
```

## 4.删除属性


```
var book={
            title:'Gone with the wind',
            data:'1920'
         }
         
delete book.title;

delete操作符将属性与对象脱离
delete只能删除自有属性 不能删除原型属性
delete不能删除不可配置的属性{configurable:false}
```


## 5.属性访问器
- 对象直接量属性值可以用一对访问器方法替代，但最好同时设置value属性与访问器属性。

```
var o={
    a:9,
    b:1,
    squareroot:10,
    set squareroot(sr){
        var oldSquareRoot=Math.sqrt(this.a*this.a+this.b*this.b);
        this.a*=value/oldSquareRoot;
        this.b*=value/oldSquareRoot;
    },
    get squareroot(){
        return Math.sqrt(this.a*this.a+this.b*this.b);
    }
}

o.squareroot;// 9.055385138137417 属性被访问器覆盖
-----
var o={
    a:9,
    b:1,
    set squareroot(sr){
        var oldSquareRoot=Math.sqrt(this.a*this.a+this.b*this.b);
        this.a*=value/oldSquareRoot;
        this.b*=value/oldSquareRoot;
    },
    get squareroot(){
        return Math.sqrt(this.a*this.a+this.b*this.b);
    },
    squareroot:10
}

o.squareroot;// undefined

```
- 属性定义方法上的存取器属性有些不同于常规属性赋值

```
// 常规属性赋值
Object.defineProperty(o,'a',{
    value:1,
    writable:true,
    enumerable:true,
    configurable:true
});

// 存取器属性赋值 value与writable被set和get方法取代
Object.defineProperty(o,'b',{
    get b(){},
    set b(param){},
    enumerable:true,
    configurable:true
});
```
可以通过静态方法`Object.getOwnPropertyDescriptor()`获取以上四个属性描述符。

```
Object.getOwnPropertyDescriptor(o,'a');
// 返回值
{
    value:1,
    writable:true,
    enumerable:true,
    configurable:true
}

Object.getOwnPropertyDescriptor(o,'b');
// 返回值
{
    set:function,
    get:function,
    enumerable:true,
    configurable:true
}
```

## 6.元素属性

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