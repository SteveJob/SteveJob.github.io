---
title: Promise 简单实现
updated: 2017-09-13
layout: 2017/blog
---

从实例化一个Promise开始
---------
{: .-no-hide}

通常，使用Promise最普遍的方式是：

```
new Promise(function(resolve) {
    // 异步任务
    setTimeout(() => {
        resolve('第一个promise 成功')
    }, 3000)
})
.then((res) => {
    console.log(res)
})
```
进阶一点，在then中再返回一个Promise：

```
new Promise(function(resolve) {
    // 异步任务
    setTimeout(() => {
        resolve('第一个promise 成功')
    }, 3000)
})
.then(function(res){
    return new Promise(function(resolve){
        // 异步任务
        setTimeout(() => {
            resolve('第二个promise 成功')
        }, 3000)
    })
})
.then((res) => {
  console.log(res)
})
```

还有一些极端情况，待分析完这种普通用法之后再作讨论。

`new Promise`实例化Promise：

![instancePromise](/assets/img/instancePromise.png)

传参被称为executor函数，Promise会在实例化的过程中立即调用这个传入的函数，并构造resolve和reject函数传给这个executor。这一步跟JavaScript callback没有不同。在此之前还将此promise的status设置为`pending`。

用户通常在executor中执行一些异步操作，待异步任务完成后，再视情况调用Promise类构造的resolve或reject。在任务完成之前，promise的status一直都是`pending`。

然后Promise会继续向下执行自身实例原型上的`then`方法。

![promiseThen](/assets/img/promiseThen.png)

`then`方法接收promise.status发生改变时的处理函数`onFullfilled`和`onRejected`，还会创建一个新Promise，并且将此三者都保存在调用者promise的一个数组中待调用者promisestatus发生变化后取用。最后将`then`中新建的promise返回出去，如此便可以实现`then`方法的链式调用。

接下来就是等待异步任务完成之后，主动调用我们在实例化Promise时从Promise哪里接收到的`resolve`和`reject`方法了。

根据示例，我们的异步任务setTimeout在三秒钟后结束，并主动调用`resolve`传递执行结果：

```
// 异步任务
setTimeout(() => {
   resolve('第一个promise 成功')
}, 3000)
```


三秒钟之后，果然收到了resolve的调用。我们知道，resolve是实例化Promise时，Promise给我们构建的，这里就继续进入其中看看resolve方法是怎样实现的。

在这里会修改promise的`value`和`status`，然后执行`onFullfilled`或`onRejected`函数。

