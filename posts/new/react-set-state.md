---
title: Fiber 架构下 React setState 的实现原理
updated: 2019-03-09
layout: 2017/blog
intro: 基于 React 16.8 源码，分析使用频率最高的 setState 的实现。
  <a target="_blank" class="tagline" href="https://space.bilibili.com/16464410/video?tid=0&page=1&keyword=&order=pubdate">→ 即将更新 setState Vlog</a>
---

ReactComponent
---------
{: .-no-hide}

> React.Component是所有组件的基类

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
  invariant(
    typeof partialState === 'object' ||
      typeof partialState === 'function' ||
      partialState == null,
    'setState(...): takes an object of state variables to update or a ' +
      'function which returns an object of state variables.',
  );
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};
```

当我们在React组件里调用setState方法时，实际上是在调用基类Component的setState。Component类本身并不会实现更新组件state的逻辑，因为在React的设计中，更新state是调度工作，统一交给react-reconciler去做，所以，这里的setState只是把工作交接给一个叫**this.updater**的东西。


## this.updater

> ReactFiberClassComponent.js文件中的adoptClassInstance中有对React.Component实例的updater属性(this.updater)做赋值操作；constructClassInstance方法里调用了adoptClassInstance方法。ReactFiberBeginWork.js中mountIndeterminateComponent函数有调用adoptClassInstance；updateClassComponent、mountIncompleteClassComponent两个函数中有调用constructClassInstance。

```js
function adoptClassInstance(workInProgress: Fiber, instance: any): void {
  instance.updater = classComponentUpdater;
  workInProgress.stateNode = instance;
  // The instance needs access to the fiber so that it can schedule updates
  setInstance(instance, workInProgress);
}

function constructClassInstance(
  workInProgress: Fiber,
  ctor: any,
  props: any,
  renderExpirationTime: ExpirationTime,
): any {
  let isLegacyContextConsumer = false;
  let unmaskedContext = emptyContextObject;
  let context = null;
  const contextType = ctor.contextType;
  if (typeof contextType === 'object' && contextType !== null) {
    context = readContext((contextType: any));
  } else {
    unmaskedContext = getUnmaskedContext(workInProgress, ctor, true);
    const contextTypes = ctor.contextTypes;
    isLegacyContextConsumer =
      contextTypes !== null && contextTypes !== undefined;
    context = isLegacyContextConsumer
      ? getMaskedContext(workInProgress, unmaskedContext)
      : emptyContextObject;
  }

  const instance = new ctor(props, context);
  const state = (workInProgress.memoizedState =
    instance.state !== null && instance.state !== undefined
      ? instance.state
      : null);
  adoptClassInstance(workInProgress, instance);

  // Cache unmasked context so we can avoid recreating masked context unless necessary.
  // ReactFiberContext usually updates this cache but can't for newly-created instances.
  if (isLegacyContextConsumer) {
    cacheContext(workInProgress, unmaskedContext, context);
  }

  return instance;
}
```

在调度模块的**ReactFiberClassComponent.js**文件里有一个adoptClassInstance方法，**this.updater**便源于这个方法。遍览React源码，为**this.updater**赋值的操作只有这一处。什么时候赋的值？必然是在组件实例化之后。在上一篇博客中，我提到了beginWork这个大的流程，在beginWork中，如果当前正在调度的Fiber的type是一个Class Component，会创建或更新这个Class Component的实例。在**this.updater**赋值的地方大哥断点，观察一下历史调用栈：


从动图中沿着函数历史调用栈向前，来到了**ReactFiberClassComponent.js**的constructClassInstance方法。可以看到，组件这里初次执行实例化，实例化完成便调用了**adoptClassInstance(workInProgress, instance)**，解开了上面那个**setState**中this.updater的谜团。
继续向前，来到了**ReactFiberBeginWork.js**的updateClassComponent方法。在这里可以看到，当首次调度一个组件Fiber时，我们需要先实例化这个组件。workInProgress就是这个正在调度中的Fiber，完成调度之后，它就成了current。


暂且顺着**this.updater.enqueueSetState**的调用继续前行。

```js
const classComponentUpdater = {
  isMounted,
  // inst是调用setState的组件实例
  enqueueSetState(inst, payload, callback) {
    // inst._reactInternalFiber
    const fiber = getInstance(inst);
    const currentTime = requestCurrentTime();
    const expirationTime = computeExpirationForFiber(currentTime, fiber);

    const update = createUpdate(expirationTime);
    update.payload = payload;
    if (callback !== undefined && callback !== null) {
      if (__DEV__) {
        warnOnInvalidCallback(callback, 'setState');
      }
      update.callback = callback;
    }

    flushPassiveEffects();
    enqueueUpdate(fiber, update);
    scheduleWork(fiber, expirationTime);
  },
}
```
**classComponentUpdater.enqueueSetState**的执行流程仿佛ReactDOM.render时调用的**updateContainer**。在哪个组件里调用setState就在哪个组件的Fiber上开始调度。


![fiber-root](/assets/img/fiber-root.png)

expirationTime与光年的定义都有着同样的春秋笔法，光年是一个与时间相关的表示距离的单位，而expirationTime是一个与时间相关的表示优先级的单位。expirationTime越大表明优先级越高。光年=3*10^8 * 365 * 3600米。相对页面初始化的毫秒时间=(1073741822 - expirationTime) * 10。