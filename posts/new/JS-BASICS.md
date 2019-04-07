---
title: Javascript 基础
updated: 2018-02-21
layout: 2017/blog
---

0.模块化
---------
{: .-no-hide}


> es6提供了语言层面的模块化支持。之前有用过AMD规范下的requirejs，但还是需要引入外部类库，未来的JavaScript语言就会直接支持模块定义和导入。

es6文件中的属性和函数定义在外部不可见，可通过`export`关键字导出，在依赖文件中通过`import`关键字导入。有点类似nodejs的使用方式。但其实差别很大。

```
//dependencies.js
function func1(){};
function func2(){};
function func3(){};
export{func1,func2,func3}

//main.js
import {func1,func2,func3} from './dependencies.js'
func(){
    func1();
    func2();
    func3();
}
export default{
    func:func
}
```
使用`export default`导出一个对象，在导入时自定义名称。

```
//_1.js
export default{
    func:func
}
//_2.js
import one from './_1.js'
```
es6自动启用严格模式，也许这就是在es5里声明`'use strict'`的意图吧，可以让开发者更好地向下一代js语言标准过渡。变量必须在声明后才能使用，但import语句是声明提升的，也就是说无论在哪里导入模块（前提是在顶级作用域里）都可以在程序执行之前导入完成。


### 一个文件就是一个模块
定义变量和函数不会默认添加到window上变成全局变量了，仍然可以使用`export`建立外部可见的函数和变量，但这并不是将其挂载到window上，模块内部中`this`指向的是`undefined`。只能通过`import`关键词将这些导出的变量或函数导入另一个模块。

```
//testexport.js
export var first=1;
export function TestModule(){};

var variables=10;
function Func(){};
export { variables , Func }
-----------
// error
var variables=10;
function Func(){};
export variables;
export Func;
```
编译时进行，动态导出。

`import`关键字在模块中用于导入另一个模块使用`export`导出的一些变量与函数。`import`命令编译期便提升进行。

```
//testimport.js
import { first,TestModule,variables,Func } from './testexport.js'
```
>由于import是静态执行，所以不能使用表达式和变量，这些只有在运行时才能得到结果的语法结构。- ryf

export同样无法在块级作用域里导出。

```
// 报错
import { 'f' + 'oo' } from 'my_module';

// 报错
let module = 'my_module';
import { foo } from module;

// 报错
if (x === 1) {
  import { foo } from 'module1';
} else {
  import { foo } from 'module2';
}

以上  'f'+'oo'  是在程序运行是才知道运算结果，而import在程
序装载后运行前就已经开始导入。第二种情形也是如此，import时
module的声明还未执行，值还未知。第三种情形，无法用在块作用域
中，块作用域运行时与import的编译时冲突。
```

### export default

export default与export使用上的区别：

```
//可行
function a(){}
export default a;

//报错
function a(){}
export a;
---------
//b.js
export default function b(){}
//c.js可行
import b from './b.js'
//c.js可行
import varb from './b.js'

//b.js
export function b(){}
//c.js报错
import b from './b.js'
//c.js报错
import varb from './b.js'
//c.js正确
import {b} from './b.js'
```
export default在一个模块里只能使用一次，故而在另一个模块里导入时不用大括号，因为对应模块只可能导出一个函数或对象。
>本质上，export default就是输出一个叫做default的变量或方法，然后系统允许你为它取任意名字。- ryf


### es6与commonjs差异

>CommonJS 模块输出的是一个值的拷贝，ES6 模块输出的是值的引用。
CommonJS 模块是运行时加载，ES6 模块是编译时输出接口。 - ryf

CommonJS通过module.exports导出，使用require引入的时候，得到的就是这个exports对象，所以，CommonJS中，当一个模块运行完成后，才会得到这个对象，也正反应了CommonJS模块是运行时加载的。这种加载方式有一个缺陷，在另一个模块里看不到被导入模块内导出的基本类型的状态变化，因为是值拷贝，导入模块里的拿到的是被导入模块的值或地址的拷贝。

```
//a.js
export var base='base';
export function Quote(){base+='base'}

//b.js
import {base , Quote} from './a.js';
console.log(base);//'base'
Quote();
console.log(base);//'basebase'
```
引用类型不存在这个问题，因为在导入模块拿到的是引用类型的地址。通过操作这个地址，相当于操作同一个对象。

```
//a.js
export obj={key:'value'};
export function changeObj(){obj.key+='vaule'}

//b.js
import {obj,changeObj} from './a.js'
console.log(obj);//{key:'value'}
changeObj();
console.log(obj);//{key:'valuevalue'}
```

但对于ES6来说，基本类型也不会存在这个问题。
>JS 引擎对脚本静态分析的时候，遇到模块加载命令import，就会生成一个只读引用。等到脚本真正执行时，再根据这个只读引用，到被加载的那个模块里面去取值。ES6 模块不会缓存运行结果，而是动态地去被加载的模块取值，并且变量总是绑定其所在的模块。由于 ES6 输入的模块变量，只是一个“符号连接”，所以这个变量是只读的，对它进行重新赋值会报错。- ryf

```
// lib.js
export let obj = {};

// main.js
import { obj } from './lib';

obj.prop = 123; // OK
obj = {}; // TypeError
```
上面代码中，main.js从lib.js输入变量obj，可以对obj添加属性，但是重新赋值就会报错。因为变量obj指向的地址是只读的，不能重新赋值，这就好比main.js创造了一个名为obj的const变量。

>export通过接口，输出的是同一个值。不同的脚本加载这个接口，得到的都是同样的实例。- ryf

```
// mod.js
function C() {
  this.sum = 0;
  this.add = function () {
    this.sum += 1;
  };
  this.show = function () {
    console.log(this.sum);
  };
}

export let c = new C();
------
// x.js
import {c} from './mod';
c.add();

// y.js
import {c} from './mod';
c.show();

// main.js
import './x';
import './y';
------
//执行main.js
$ babel-node main.js
1
```

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

```js
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


## 7.el
el.children ===> 返回直接子元素
el.childNodes ===> 返回直接子节点（文本 元素 无属性节点）
el.firstChild ===> 包括文本元素

## 8.canvas
canvas元素可以通过width、height获取和设置宽高。其他元素不行，只能通过offsetWidth、ffsetHeight获取，而且不能通过这种方式设置


## 9.节点树与文档树
原生js有节点树和文档树的概念。

- 节点树
把DOM当做一个节点树来操作的时候，API返回的是一个Node或NodeList对象，包括文本节点和注释节点等CharacterData类型的节点。
接口示例：

```
parentNode
childNodes
firstChild/lastChild
nextSibling/previousSibling
------
nodeType
nodeValue
nodeName
```
- 元素树
把DOM看做一个元素树时，相关API返回的Node不会是CharacterData对象，NodeList对象里也仅包含Element类型的对象，相当于把文本节点都过滤掉之后的DOM结构，比较符合我们的认知。相反，把文本和注释混杂在元素节点里返回倒有点让人费解。

```
children(>>>childNodes)
firstElementChild/lastElementChild(>>>firstChild/lastChild)
nextElementSibling/
firstChild/lastChild
nextElementSibling/previousElementSibling(>>>nextSibling/previousSibling)
childElementCount(与children.length数值相同)
------
nodeType
nodeValue
nodeName
```
这棵树才是重点。

## 10.HTMLElement

####1.标准属性（读写属性）
HTMLElement对象定义了通用的HTML元素==读写==属性和事件处理程序（id lang onclick）。特定的HTMLElement子类型还定义了特殊的属性（img元素的src属性）。
读写属性就是可以直接通过对象属性名获取或赋值的属性。

对于form表单，有这样的==读写属性==：

```
var form=document.forms[0];
form.action='http:\/\/www.xxx.com/api/users/102033';
form.method='get';
```
直接通过属性名操作。在jQuery里面已经是非常普遍了。

**注**：如果属性名有连字符，要采用驼峰写法。
**注**：如果属性名是JavaScript保留字，一般加上html前缀，如label.htmlFor，但对于类名则是el.className。（class也是JavaScript保留字）
**注**：读写属性区分大小写。下面的方法获取属性值不区分。

#### 2.非标准属性

Element对象上定义，主要就是两个属性值操作方法：

```
getAttribute();
setAttribute();
-------
hasAttribute();
removeAttribute();
```

#### 3.数据集属性

这个我在jQuery中经常使用。在JavaScript语言层面，Element对象上定义了一个dataset属性，属性值是一个对象，对象里保存了data-属性的键值对。

```
<p data-t="test" data-sec-attr="sec"></p>

var ds=document.getElementsByTagName('p')[0].dataset;
console.log(ds);
//{
//  t:"test",
//  secAttr:"sec"
//}
```

## 11.数组map reduce操作

**reduce：**向reduce方法传入一个回调函数，回调函数包括两个参数。在第一次执行时第一个参数表示数组的第一个值，以后每次执行都表示上一次的函数返回值。第二个参数在第i次执行时表示数组第i+1个值。数组执行至第i-1次自动结束。（==返回值为最后一次回调函数的返回值==）

**map：**向map传入一个回调函数，回调函数接受一个参数。参数来自数组中的一个个成员。执行i次后结束（==返回值是每次执行回调的返回值组成的新数组==）

**filter：**向filter传入一个回调函数，回调函数接受一个参数，返回值如果为true或可转化为true，则留在数组中，否则从数组中清除。（==返回值是原来的数组，但已经被改变，不符合判断条件的已经被清楚。==）

**注意：**reduce返回的是值，map filter返回的是数组，而且都是immutable，与concat slice一样，不会对原来的数组有影响。push shift splice这种是mutable。

**数组.join & 字符串.split：**数组变成字符串，字符串合并为数组。

**字符串截取：**substr(0,1)从第一个字符开始截取一个；substring(0,1)从第一个字符开始，截取到第二个。substr类似数组方法splice但substr不会改变字符串，substring类似数组方法slice。

