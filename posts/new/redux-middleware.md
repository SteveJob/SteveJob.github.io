---
title: 从 Redux 中间件架构设计看函数式编程
updated: 2018-05-01
layout: 2017/blog
---

什么是redux中间件
---------
{: .-no-hide}

redux是大型react应用不可或缺的工具库，是react组件的数据共享中心，是react生态圈的骨架。其中间件架构设计则极大地增加了可扩展性。掌握redux中间件架构不仅可以用来为自己的项目编写redux中间件，更有助于丰富自己的架构设计思想，让下一个流行库的作者是自己，成为可能。此外，这种架构在JavaScript语言世界使用的非常普遍，NodeJS的koa的中间件架构同样如此。

![reduxDataFlow](https://ws4.sinaimg.cn/large/006tNc79ly1g1up59sjz1j30pj0do759.jpg)

如上图，redux实现了单向数据流，


## 什么是函数式编程
提到函数式编程，我们能够想到的是`不修改全局变量`、`不操作磁盘`、`不触发事件`...


## redux中间件架构里的函数式编程

![reduxMiddleware](https://ws4.sinaimg.cn/large/006tNc79ly1g1up5o2v5vj31hg0bstaa.jpg)

在面向对象语言里，`过滤器`是继承某个特定父类或实现某个特定接口的`class`。在函数式编程语言中概念类似，`中间件`是一个具有特定签名的函数。

redux的中间件函数签名是：

```
({ dispatch, getState }) 
    => next 
    => action 
    => next(action)
```


只要我们按照这个签名实现一个函数，并放进redux的`applyMiddleware函数`中，我们就实现了一个简单的中间件。这里的`dispatch`和`getState`就是我们通过`createStore`创建出来的store对象的两个属性。

那`next`是什么？`action`又是什么？`next(action)`又是什么？这个...不结合源码是说不清楚的。下面就深入源码一探究竟。

首先我们要知道，我们编写的中间件是怎么整合进redux的。

```
// applyMiddleware.js
export default function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer)
    let dispatch = store.dispatch
    let chain = []

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }
        chain = middlewares.map(middleware => middleware(middlewareAPI))
    dispatch = compose(...chain)(store.dispatch)

    return {
      ...store,
      dispatch
    }
  }
}
```

抽出`applyMiddleware函数`的签名可以得到：

```
(...middlewares) 
    => createStore 
    => (reducer, preloadedState, enhancer) 
    => store
```
从签名得知，所有redux middleware在执行`applyMiddleware函数`后会被放进参数`middlewares`数组中。`applyMiddleware函数`的返回值：

```
createStore 
    => (reducer, preloadedState, enhancer) 
    => store
```

这个返回值函数有个特有的名称，叫`enhancer`，他是createStore的enhancer。enhancer之于createStore犹如middleware之于dispatch。

这个`enhancer`的使用方法是，作为创建store时的一个参数：

```
const Store = createStore(reducer, preloadedState?, enhancer)
```

这里的preloadState时可选的，没错，即使他不是最后一个参数，他也可以作为可选参数，这是`createStore函数`的特殊之处。函数内部会做判断，如果只有两个参数，会将第二个参数赋值给第三个参数`enhancer`。

```
export default function createStore(reducer, preloadedState, enhancer) {
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  // enhancer只是createStore的一个装饰器 (只修改了store的dispatch) 这就是为什么派发的action会被中间件拿到 因为dispatch被掉包了
  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }
    return enhancer(createStore)(reducer, preloadedState)
  }
}  
```

这里的代码只有一句是功能性的，也是最难理解的。我们可以将上述函数除return那一句外，全都拿掉。`createStore`只做了一件事：

```
return enhancer(createStore)(reducer, preloadedState)
```
这是在做什么？结合前面写的`enhancer`的函数签名就知道了。再重述一遍，`applyMiddleware函数`的返回值，也就是`enhancer`的函数签名是：

```
createStore 
    => (reducer, preloadedState, enhancer) 
    => store
```
 
所以`createStore`的返回值就是这里的store。这是函数式编程的难理解之处也是有趣之处。我们来分解一下：

```
// ①applyMiddleware签名
(...middlewares) 
    => createStore 
    => (reducer, preloadedState, enhancer) 
    => store

// ②enhancer签名
createStore 
    => (reducer, preloadedState, enhancer) 
    => store

// ③createStore签名
(reducer, preloadedState, enhancer)
    => store    
```

结合②③看一下我们得到了什么？没错，`enhancer`**原来是个 ！！！**

```
createStore => createStore
```

再回到`applyMiddleware.js`源码：

```
// applyMiddleware.js
export default function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState, enhancer) => {
    /* ********************* */
    const store = createStore(reducer, preloadedState, enhancer)
    let dispatch = store.dispatch
    let chain = []

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }
    chain = middlewares.map(middleware => middleware(middlewareAPI))
    dispatch = compose(...chain)(store.dispatch)
    return {
      ...store,
      dispatch
    }
    /* ********************* */
  }
}
```

之前我们说过，createStore只做了一件事就是：

```
// createStore.js
export default function createStore(reducer, preloadedState, enhancer) {
    return enhancer(createStore)(reducer, preloadedState)
}
```

还说过，`applyMiddleware`的返回值叫做`enhancer`，结合上面两段源码`applyMiddleware.js`和`createStore.js`，可以得知，通过执行星号框选的代码，我们拿到了store。如果没有中间件，执行`createStore`时不会像上面这样返回`enhancer`的调用结果，而是直接返回一个store对象，包括dispatch、getState、subscribe等属性。而传入了中间件之后，一切都变了。要调用`enhancer`，要多执行一段`applyMiddleware`中星号框选的那一段代码，然后，那一段代码的返回值作为我们的store对象，也有dispatch、getState、subscribe等属性。所以，redux中间件带来的改变就是store对象的改变，准确的说，是这一段代码执行后对store对象所做的改变。

我们来详细分析一下这一段代码做了什么。

```
// 第一步
const store = createStore(reducer, preloadedState, enhancer)
```
这里的createStore就不会走`return enhancer(..)(..)`这个流程了，而是直接返回store，也就是我们不使用中间件时创建的原始的store。如果将这个store返回，那我们的中间件相当于没有起到任何作用。到这里，store对象还未发生改变。

```
// 第二步
const middlewareAPI = {
     getState: store.getState,
     dispatch: (...args) => store.dispatch(...args)
}
chain = middlewares.map(middleware => middleware(middlewareAPI))
```
这里是在执行我们写的中间件。我们写的中间件的函数签名还记得吗？

```
({getState, dispatch}) => next => action => next(action)
```
所以第二步的执行结果是得到了一个`next => action => next(action)`函数数组。store对象还是没有变化，但确认了一件事，中间件接收的参数是原始的`store.getState`、`store.dispatch`。回到一开始的疑问：next是什么、action又是什么？下一步揭晓。

```
// 第三步
dispatch = compose(...chain)(store.dispatch)
```
这一步最关键，依稀能够看出，compose函数拿着我们的中间件执行后得到的`next => action => next(action)`函数数组对`dispatch`做了一些改变。先不管，看最后一步。

```
// 第四步
return {
     ...store,
     dispatch
}
```
把`dispatch`掉包，返回掉包后的store对象。所以，中间件只做了一件事，改变了我们用来派发action的`dispatch`。原来的`dispatch`长什么样？

```
function dispatch(action) {  
  try {
    isDispatching = true
    // 脏检查  根据旧state和action生成新的state
    currentState = currentReducer(currentState, action)
  } finally {
    isDispatching = false
  }

  // 通知监听者 state发生改变 快通过store.getState去取
  const listeners = currentListeners = nextListeners
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i]
    listener()
  }
  
  // 原样返回
  return action
}
```

compose是如何利用中间件修改的`dispatch`？

```
// compose函数源码
export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }
  return funcs.reduce((a, b) => (...args) => a(b(...args))) 
}
```

如果只有一个中间件，很好理解，`compose(...chain)`返回`chain[0]`，签名为`next => action => next(action)`，以一个简单的中间件为例：

```
const middleware = (store: {getState, dispatch}) => next => action => {
    console.log('DemoMiddleware start')
    next(action)
    console.log('DemoMiddleware stop');
}
```

next就是原始的dispatch。

```
dispatch = compose(...chain)(store.dispatch)
```
返回的`dispatch`变成了：

```
function dispatch(action) {  
  console.log('DemoMiddleware start')
  store.dispatch(action)
  console.log('DemoMiddleware stop');
}
```
也就是说，我们可以拦截每一次`dispatch`，在真正派发前后都可以做一些操作，甚至是不派发这次操作。

多个中间件的时候呢？重点在`compose`函数上。

假设我们传入了三个中间件，这时，`compose(...chain)(store.dispatch)`后得到的dispatch会变成什么样子：

```
chain = [
    next1 => action1 => next1(action1),
    next2 => action2 => next1(action2),
    next3 => action3 => next1(action3),
]

dispatch = compose(...chain)(store.dispatch)

// compose函数
function compose(...funcs) {
  return funcs.reduce((a, b) => (...args) => a(b(...args))) 
}
```
有点烧脑，如下：

```
dispatch 
    =   ( next1=>action1=>next1(actions1) )
        ( next2=>action2=>next2(actions2) )  
        ( next3=>action3=>next3(actions3) ) 
        ( store.dispatch ) // next3 = dispatch
        
    // function dispatch3(action) {  
    //  console.log('DemoMiddleware3')
    //  store.dispatch(action)
    //  console.log('DemoMiddleware3');
    // }
    =   ( next1=>action1=>next1(actions1) )
        ( next2=>action2=>next2(actions2) )  
        ( action3=>dispatch3(actions1) )
        
    // function dispatch2(action) {  
    //  console.log('DemoMiddleware2')
    //  dispatch3(action)
    //  console.log('DemoMiddleware2');
    // }
    =   ( next3=>action3=>next3(actions3) )
        ( action2=>dispatch2(actions2) )
        
    // function dispatch1(action) {  
    //  console.log('DemoMiddleware1')
    //  dispatch2(action)
    //  console.log('DemoMiddleware1');
    // }
    =   action1=>dispatch1(actions1)
```

我们的`dispatch`首先被调包为`dispatch3`，`dispatch3`被调包为`dispatch2`，`dispatch2`被调包为`dispatch1`，最终返回的store的dispatch属性就是`dispatch1函数`。当我们在组件里dispatch一个action时经历了如下过程：

```
action => dispatch1(action) => dispatch2(action) => dispatch3(action) => dispatch(action)
```
![redux](https://ws4.sinaimg.cn/large/006tNc79ly1g1up68we7ug30g00a0x6q.gif)

![reduxMiddleware](https://ws4.sinaimg.cn/large/006tNc79ly1g1up5o2v5vj31hg0bstaa.jpg)

