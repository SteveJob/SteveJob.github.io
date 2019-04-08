---
title: Fiber 架构下 React setState 的实现原理
updated: 2019-03-09
layout: 2017/blog
intro: 基于 React 16.8 源码，分析使用频率最高的 setState 的实现细节。
---

组件的基类 ReactComponent
---------
{: .-no-hide}

由于 Class Component 继承自 React Component，所以当我们在 React 组件里调用 setState 方法时，实际上是在调用基类 React Component 的 setState 。然而，当我们想了解 React 是怎么实现声明式编程 —— `setState` 万金油的时候，却发现，它根本不在其中。

React Component 类并没有实现更新组件 state 的逻辑。因为在 React 的设计中，更新 state 是调度工作，统一交给react-reconciler 去做。
这样就可以很方便地把这种编程范式应用到 iOS 、Android 或 canvas 等等视图中去。
所以，这里的setState只是把工作交接给一个叫 **this.updater** 的东西，毋庸置疑，`updater` 一定来自 react-reconciler 。

*packages/react/src/ReactBaseClasses.js - Line:21*

```js
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

从 Component 基类的定义上看，`updater` 在 Class Component 实例化时被赋初始值。
因此，我们需要从组件实例化的地方出发，才能找到 `updater` 的具体实现。你也可以参考我录制的 
[React Key的实现原理](https://www.bilibili.com/video/av48472416) 和 [ReactDOM.render 源码探索 Fiber 调度](https://www.bilibili.com/video/av47452571) 两个 Vlog。


## 寻找 updater

为了找到 updater ，我准备了一个简单的用例。首先，我们要去探索，用例中的 Example 组件是如何实例化的：

```js
class Example extends Component {
  state = { count: 0 }

  handleClick = () => {
    this.setState(({ count }) => ({
      count: count + 1,
    }));
  }

  render() {
    const { count } = this.state;

    return (
      <div>
        <p>You clicked {count} times</p>
        <button ref={btnRef} onClick={this.handleClick}>Click me</button>
      </div>
    );
  }
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

在开始调度之前，React 会根据组件类型的不同，区别不同的调度函数。updateClassComponent 是 React 中调度 Class Component 的函数。React 在 workLoop 函数中，从起点 RootFiber 出发，沿着 Fiber 链表不断遍历，调度每一个 Fiber 节点。来到我们的 Example 组件：

*packages/react-reconciler/src/ReactFiberBeginWork.js - Line:1893*

```js
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
): Fiber | null {
  ...
  switch (workInProgress.tag) {
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      const resolvedProps =
        workInProgress.elementType === Component
          ? unresolvedProps
          : resolveDefaultProps(Component, unresolvedProps);
      return updateClassComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderExpirationTime,
      );
    }
    ...
    ...
  }
}
```

如我们所预期，Example 组件的调度过程将交给 updateClassComponent 去完成。在 updateClassComponent 中专门有一个函数负责实例化 Class Component：

*packages/react-reconciler/src/ReactFiberBeginWork.js - Line:674*

```js
constructClassInstance(
  workInProgress,
  Component,
  nextProps,
  renderExpirationTime,
);
```

在 constructClassInstance 函数中，`new ctor` 向我们的 Example 组件的构造函数传递了两个参数，props 和 context ，
拿到了组件实例。但是，React Component 基类接收 updater 的是构造函数的第三个参数，因此，实例化组件之后，此时 `this.updater` 仅仅是无具体实现的默认值 ReactNoopUpdateQueue。

*packages/react-reconciler/src/ReactFiberClassComponent.js - Line:506*

```js
function constructClassInstance(
  workInProgress: Fiber,
  ctor: any,
  props: any,
  renderExpirationTime: ExpirationTime,
): any {
  ...
  const instance = new ctor(props, context);
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null);
  adoptClassInstance(workInProgress, instance);
  ...
  return instance;
}
```

拿到组件实例之后，调用了一个方法，adoptClassInstance 。查看 adoptClassInstance 的内容发现，在这里为组件实例  instance 的 updater 赋了值。至此，便解开了 **setState** 中的 updater 谜团。

*packages/react-reconciler/src/ReactFiberClassComponent.js - Line:506*

```js
function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance;
}
```

## setState 时发生了什么

上一节，我们找到了调用 setState 时所使用的 updater，其定义如下：

*packages/react-reconciler/src/ReactFiberClassComponent.js - Line:181*

```js
const classComponentUpdater = {
  isMounted,
  enqueueSetState(inst, payload, callback) {
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTime();
    const expirationTime = computeExpirationForFiber(currentTime, fiber);

    const update = createUpdate(expirationTime);
    update.payload = payload;
    ...
    flushPassiveEffects();
    enqueueUpdate(fiber, update);
    scheduleWork(fiber, expirationTime);
  },
  enqueueReplaceState(inst, payload, callback) {
    ...
  },
  enqueueForceUpdate(inst, callback) {
    ...
  },
};
```

接着我们通过在 button 组件上派发一个 click 事件，触发一次 Example 组件内的 setState 操作。根据 React 在其 Component 基类里的 setState 定义：

```js
Component.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

此时，程序会来到 classComponentUpdater 的 enqueueSetState 函数。enqueueSetState 函数的实现似曾相识，当调用 ReactDOM.render 时，调用的 scheduleRootUpdate 也有类似的操作：

```js
function scheduleRootUpdate(
  current: Fiber,
  element: ReactNodeList,
  expirationTime: ExpirationTime,
  callback: ?Function,
) {
  const update = createUpdate(expirationTime);
  update.payload = {element};
  ...
  flushPassiveEffects();
  enqueueUpdate(current, update);
  scheduleWork(current, expirationTime);

  return expirationTime;
}
```

仅有的差别就是，enqueueSetState 中的fiber 代表着为 Example 组件创建的 FiberNode，而 scheduleRootUpdate 中的 current 是整个 Fiber Chain 的起点 RootFiber 。
而且这点差别，也将在 他们共同的调用 `scheduleWork` 中消除。因为每次通过 `scheduleWork` 进入调度流程后，都要从  RootFiber 开始调度。
还有就是他们的 fiber 节点要执行的更新 `update.payload` 不同。

enqueueUpdate 函数将此次 setState 所要执行的更新放到 fiber 上的更新队列 `updateQueue`中。
然后执行 scheduleWork 进入 Fiber Chain。
