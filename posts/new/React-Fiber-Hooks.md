---
title: Fiber 架构下 React Hooks 的实现原理
updated: 2019-04-03
layout: 2017/blog
intro: React Hooks，站在 Fiber 的肩膀上，起飞。
  <a target="_blank" class="tagline" href="https://space.bilibili.com/16464410/video?tid=0&page=1&keyword=&order=pubdate">→ 即将更新 Hooks Vlog</a>
---

React 官方文档用独立的一个系列的篇幅介绍了 Hooks ，可见其在 React 中的重要程度。那什么是 Hooks ？
Hooks 是赋予 Function Component 的武器。React 认为 JavaScript 中 class 是复杂的，学习成本较高。
而 JavaScript 的开发者一直以来对函数情有独钟。从 jQuery 时代开始，各种函数、闭包、自执行。
Hooks 赋予了函数组件使用更多 React 特性的能力。
使用 Hooks 并不仅仅是为了给编写形式较简单的 Function Component 中加入 state 或 effect ，更能够以 `useXXX` 的形式将 state 和 effect 从组件中彻底抽离。
这样来看，Hooks 的矛头，似乎不只是对着 Class Component。它甚至想要取代 HOC 、 render props。


## useState 的定义

查看 React 导出的 `useState` 方法，会发现，它仅仅是 `ReactCurrentDispatcher` 对象的代理方法：

```js
function useState<S>(initialState: (() => S) | S) {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}
```

resolveDispatcher() 函数返回了`ReactCurrentDispatcher` 对象的 current，然而当我们打开 ReactCurrentDispatcher.js 文件才发现，上面并没有 `useState` 等 Hooks 方法。

```js
/**
 * Keeps track of the current dispatcher.
 */
const ReactCurrentDispatcher = {
  /**
   * @internal
   * @type {ReactComponent}
   */
  current: (null: null | Dispatcher),
};
```

这种现象在 React 的源码中已经不是第一次出现了。如果你曾探索过 `React.Component` 的 `setState` 是如何实现的，会同样扑了个空。

不难理解，在 React 调用 Function Component 之前一定对 `ReactCurrentDispatcher` 重新赋了值。

不妨放弃这个思路，一起来看一下，React 是如何挂载和更新 Function Component 的？


## Function Component 与 useState 的协作

进入源码之前，准备了一个简单的参考用例：

```js
const {createRef, useState} = React;

function Example() {
  // Declare a new state variable, which we'll call "count"
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button ref={btnRef} onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}

const btnRef = createRef();

ReactDOM.render(
  <Example />,
  container,
);

btnRef.current.dispatchEvent(
  new Event('click', {bubbles: true, cancelable: true}),
);
```

在 beginWork 时，React 会根据组件类型的不同，调用不同的函数来分别调度。mountIndeterminateComponent 是 React 中调度 Function Component 的 Fiber 节点的函数。
它通过调用 `renderWithHooks`，拿到了组件返回的 ReactElement 对象。

*packages/react-reconciler/src/ReactFiberHooks.js - Line:286*

```js
function renderWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  props: any,
  refOrContext: any,
  nextRenderExpirationTime: ExpirationTime,
): any {
  renderExpirationTime = nextRenderExpirationTime;
  currentlyRenderingFiber = workInProgress;
  firstCurrentHook = nextCurrentHook =
    current !== null ? current.memoizedState : null;

  ReactCurrentDispatcher.current =
    nextCurrentHook === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, refOrContext);
  ...
  ...
  // We can assume the previous dispatcher is always this one, since we set it
  // at the beginning of the render phase and there's no re-entrancy.
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
  ...
  ...

  return children;
}
```

进入 `renderWithHooks`，我们发现，在执行函数组件之前，对 `ReactCurrentDispatcher.current`做了赋值，并在执行完组件之后，又重新赋了一次值。
我们的目标现在转移到了 `HooksDispatcherOnMount` 和 `HooksDispatcherOnUpdate` 上面，它们才是 `useState` 的具体实现。

初次渲染时，useState 调用 `HooksDispatcherOnMount` 中的 mountState 函数：

*packages/react-reconciler/src/ReactFiberHooks.js - Line:704*

```js
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === 'function') {
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = (hook.queue = {
    last: null,
    dispatch: null,
    eagerReducer: basicStateReducer,
    eagerState: (initialState: any),
  });
  const dispatch: Dispatch<
    BasicStateAction<S>,
  > = (queue.dispatch = (dispatchAction.bind(
    null,
    // Flow doesn't know this is non-null, but we do.
    ((currentlyRenderingFiber: any): Fiber),
    queue,
  ): any));
  return [hook.memoizedState, dispatch];
}
```

mountState 函数通过 执行 mountWorkInProgressHook 函数，创建并返回了一个 hook 对象。实际上是创建了一个 hook 链表。
如果一个 Function Component 中执行多个 hook ，这个 hook 链表就会以 `firstWorkInProgressHook` 这个 hook 为起点，通过 next 属性向后不断延伸。
这里的返回值仍然是为当前正在执行的 useXXX 函数创建的 hook 对象，它在链表上的位置由它在 Function Component 中调用的位置决定。
通过这个链表，React 实现了保存 Function Component 内的 hook 不会因为函数调用栈的 pop 而丢失。
当我们因为需要更新组件而再次调用这个 Function Component 时，会使用一个与 mountWorkInProgressHook 类似的函数 updateWorkInProgressHook，来更新这个 hook 链表。

*packages/react-reconciler/src/ReactFiberHooks.js - Line:439*

```js
function mountWorkInProgressHook(): Hook {
  const hook: Hook = { // 创建并返回新hook
    memoizedState: null,

    baseState: null,
    queue: null,
    baseUpdate: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // This is the first hook in the list
    firstWorkInProgressHook = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```

回到 mountState 函数，创建完 hook 对象后便是对其进行一系列的初始化赋值，`memoizedState`、`baseState`、`queue`、`queue.dispatch``、queue.eagerReducer`、`queue.eagerState`。
如果 useState 函数接收到的 initialState 是一个函数，还需要立即调用，返回值作为 initialState。
最终的返回值，也就是我们在 Function Component 中调用 useState 拿到的数组就是 `[hook.memoizedState, dispatch]`。`hook.memoizedState` 是我们传入的 initialState，dispatch 是什么？useState 的使用方式就是通过调用这个 dispatch 来改变 Function Component 的状态，那它是怎么实现的？带着这个疑问，继续向下走。
根据前面我们给的用例，useState 将这个数组返回之后，Function Component 就创建并返回了 div 组件的 ReactElement 对象。
然后我们的执行流程又回到了 `renderWithHooks` 函数。函数内接着便对 ReactCurrentDispatcher 做了重新赋值，再次调用 useXXX 函数都会抛错。
因此我们可以了解，只有在 Function Component 内才可以使用 hooks 。

对 ReactCurrentDispatcher 重新赋值之后，renderWithHooks 对当前调度的 Function Component 的 Fiber 节点做了一点修改：

*packages/react-reconciler/src/ReactFiberHooks.js - Line:360*

```js
renderedWork.memoizedState = firstWorkInProgressHook;
```

还记得我们在 mountState 中创建的 hook 链表吗？链表的 head hook 就是 `firstWorkInProgressHook`。React 将Function Component 的 hook 链表放到了 Fiber 上，这就是多次渲染函数组件不会丢失 state 的本质。

至此，我们挂载流程中对 hooks 的处理就结束了。


## Function Component 更新 state

下面一起看一下，更新流程，如何根据 Fiber 上的 hook 链表，为 Function Component 计算出新的 state。

在之前的用例中，我们通过 ref 拿到了 button 组件的 DOM，并在这个 DOM 上派发了一个自定义事件。这个事件的监听函数会通过调用 useState 返回的 setCount 为 Function Component 更新 state。

```js
btnRef.current.dispatchEvent(
  new Event('click', {bubbles: true, cancelable: true}),
);
```

上节我们说到 mountState 时，留下来一个疑问：dispatch 是什么？回归一下 mountState 中的代码：

```js
...
const dispatch: Dispatch<
  BasicStateAction<S>,
> = (queue.dispatch = (dispatchAction.bind(
  null,
  // Flow doesn't know this is non-null, but we do.
  ((currentlyRenderingFiber: any): Fiber),
  queue,
): any));
return [hook.memoizedState, dispatch];
```

dispatch 方法是一个被注入了相应 hook 的 `queue` 和相应 Function Component 的 `fiber` 的 dispatchAction 方法。
`queue`，和 `fiber` 之间有什么关系吗？是 dispatchAction 利用 `queue` 更新了 `fiber` 吗？

进入源码：

*packages/react-reconciler/src/ReactFiberHooks.js - Line:1009*

```js
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {
  ...
  ...
  const update: Update<S, A> = {
    expirationTime,
    action,
    eagerReducer: null,
    eagerState: null,
    next: null,
  };

  // Append the update to the end of the list.
  const last = queue.last;
  if (last === null) {
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    const first = last.next;
    if (first !== null) {
      // Still circular.
      update.next = first;
    }
    last.next = update;
  }
  queue.last = update;

  if (
    fiber.expirationTime === NoWork &&
    (alternate === null || alternate.expirationTime === NoWork)
  ) {
    const eagerReducer = queue.eagerReducer;
    if (eagerReducer !== null) {
      let prevDispatcher;
      try {
        const currentState: S = (queue.eagerState: any);
        const eagerState = eagerReducer(currentState, action);
        update.eagerReducer = eagerReducer;
        update.eagerState = eagerState;
      }
    }
  }
  scheduleWork(fiber, expirationTime);
}
```

我们看到，跟 Class Component 的 setState 类似，这里同样创建了一个 Update ，并将其加入位于 queue 上的 Update 链表。
接下来的一段代码非常很像 Redux：

```js
const currentState: S = (queue.eagerState: any);
const eagerState = eagerReducer(currentState, action);
update.eagerReducer = eagerReducer;
update.eagerState = eagerState;
```

用 queue 上的 reducer 和 state ，结合用户传进来的 action ，拿到了更新后 state 。
这样，我们就计算出了 Function Component 的新 state 。这个 state 保存在 queue 上的 Update 链表 lastUpdate  上。
如果你还记得上一节，挂载流程中我们是怎么处理 hook 的，应该可以推导出，这个 state 怎么通过 Function Component 的 fiber 拿到。
提醒你一下，Function Component 的 fiber 节点上，有一个 `memoizedState` 属性，那个属性里保存着我们的 hook 链表。