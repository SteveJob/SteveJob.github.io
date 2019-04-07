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
`mountIndeterminateComponent` 是处理 Function Component 的函数。这个函数通过调用 `renderWithHooks`，拿到了组件返回的 ReactElement 对象。

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

```js
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {

  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    didScheduleRenderPhaseUpdate = true;
    const update: Update<S, A> = {
      expirationTime: renderExpirationTime,
      action,
      eagerReducer: null,
      eagerState: null,
      next: null,
    };
    if (renderPhaseUpdates === null) {
      renderPhaseUpdates = new Map();
    }
    const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue);
    if (firstRenderPhaseUpdate === undefined) {
      renderPhaseUpdates.set(queue, update);
    } else {
      // Append the update to the end of the list.
      let lastRenderPhaseUpdate = firstRenderPhaseUpdate;
      while (lastRenderPhaseUpdate.next !== null) {
        lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
      }
      lastRenderPhaseUpdate.next = update;
    }
  } else {
    flushPassiveEffects();

    const currentTime = requestCurrentTime();
    const expirationTime = computeExpirationForFiber(currentTime, fiber);

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
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const eagerReducer = queue.eagerReducer;
      if (eagerReducer !== null) {
        let prevDispatcher;
        if (__DEV__) {
          prevDispatcher = ReactCurrentDispatcher.current;
          ReactCurrentDispatcher.current = InvalidNestedHooksDispatcherOnUpdateInDEV;
        }
        try {
          const currentState: S = (queue.eagerState: any);
          const eagerState = eagerReducer(currentState, action);
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = eagerReducer;
          update.eagerState = eagerState;
          if (is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {
          if (__DEV__) {
            ReactCurrentDispatcher.current = prevDispatcher;
          }
        }
      }
    }
    scheduleWork(fiber, expirationTime);
  }
}
```

## Function 与 useState 的协作

首先，我们来看

## Function 与 useEffect 的协作
