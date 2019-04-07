---
title: Fiber 架构下 ReactDOM.render 是如何工作的？
updated: 2019-02-27
layout: 2017/blog
intro: React Fiber调度流程一览。
  <a target="_blank" class="tagline" href="https://www.bilibili.com/video/av47452571">→ 推荐Vlog</a>
---

[ReactDOM.render 源码探索 Fiber 调度 Vlog](https://www.bilibili.com/video/av47452571)


legacyRenderSubtreeIntoContainer
---------
{: .-no-hide}


> legacyRenderSubtreeIntoContainer函数签名：

```js
function legacyRenderSubtreeIntoContainer(
  parentComponent: ?React$Component<any, any>,
  children: ReactNodeList,
  container: DOMContainer,
  forceHydrate: boolean,
  callback: ?Function
) => getPublicRootInstance(root._internalRoot); 
```

`legacyRenderSubtreeIntoContainer`在`ReactDOM.hydrate`、`ReactDOM.render`、`ReactDOM.unstable_renderSubtreeIntoContainer`、`ReactDOM.unmountComponentAtNode`中都有调用，使用方式如下：

```js
// hydrate和render的使用方式相同
function hydrate(element: React$Node, container: DOMContainer, callback: ?Function) {
  return legacyRenderSubtreeIntoContainer(null, element, container, true, callback);
}

function render( element: React$Element<any>, container: DOMContainer, callback: ?Function) {
  return legacyRenderSubtreeIntoContainer(null, element, container, false, callback);
}

// unstable_renderSubtreeIntoContainer用于在react组件上挂载新树，所以
// 相比hydrate和render，它使用legacyRenderSubtreeIntoContainer时，第
// 一个参数不会传null，而是传一个组件作为anchor。其余参数同render
function unstable_renderSubtreeIntoContainer(parentComponent: React$Component<any, any>, element: React$Element<any>, containerNode: DOMContainer, callback: ?Function) {
  invariant(isValidContainer(containerNode), 'Target container is not a DOM element.');
  invariant(parentComponent != null && hasInstance(parentComponent), 'parentComponent must be a valid React Component');
  return legacyRenderSubtreeIntoContainer(parentComponent, element, containerNode, false, callback);
}

// unmountComponentAtNode用于从一个dom节点移除组件树
unmountComponentAtNode(container: DOMContainer) {
    invariant(isValidContainer(container), 'unmountComponentAtNode(...): Target container is not a DOM element.');
    legacyRenderSubtreeIntoContainer(null, null, container, false, () => { container._reactRootContainer = null; });
}
```

通过传递不同的parentComponent、children组件、挂载DOM节点、是否脱水这些参数，使用legacyRenderSubtreeIntoContainer达到不同的目的。


## legacyCreateRootFromDOMContainer 与 unbatchedUpdates

> 函数签名：
function 

legacyCreateRootFromDOMContainer返回一个ReactRoot的实例。ReactRoot实例化时会调用ReactFiberReconciler的updateContainer方法。legacyCreateRootFromDOMContainer之后开始进行unbatchedUpdates，unbatchedUpdates时调用ReactRoot实例的render方法，render方法调用ReactFiberReconciler的updateContainer方法。

```js
function ReactRoot(
  container: DOMContainer,
  isConcurrent: boolean,
  hydrate: boolean,
) {
  const root = createContainer(container, isConcurrent, hydrate);
  this._internalRoot = root;
}

ReactRoot.prototype.render = function(
  children: ReactNodeList,
  callback: ?() => mixed,
): Work {
  const root = this._internalRoot;
  const work = new ReactWork();
  updateContainer(children, root, null, work._onCommit);
  return work;
};
```

`createContainer`方法创建了一个数据结构**FiberRoot**，这个数据结构包含current(RootFiber)、containerInfo(DOM节点)等：

![fiber-root](/assets/img/fiber-root.png)


## ms & expirationTime

>计算expirationTime

进入updateContainer流程，react标记了几个时间节点.react中使用performance api生成相对时间。

![updateContainer](/assets/img/updateContainer.png)

具体怎么计算currentTime和expirationTime，这里不做详细叙述。重点是Performance.now()生成的相对毫秒数与expirationTime这个类型之间相互转换的方法如下所示，**UNIT_SIZE**的值为10，**MAGIC_NUMBER_OFFSET**值为`2**30-1`。总的来看，距离页面加载完成的时间越短，这里计算出来的currentTime越大，反之越小。由于是我们是刚进入页面，所以，currentTime此时等于**MAGIC_NUMBER_OFFSET**。同步模式下，这里的expirationTime为`2**30`，也就是说，渲染完成之前，这个任务几乎永远不会过期。

```js
// 1 unit of expiration time represents 10ms.
function msToExpirationTime(ms: number): ExpirationTime {
  // Always add an offset so that we don't clash with the magic number for NoWork.
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0);
}

function expirationTimeToMs(expirationTime: ExpirationTime): number {
  return (MAGIC_NUMBER_OFFSET - expirationTime) * UNIT_SIZE;
}
```

然后开始进入updateContainerAtExpirationTime方法继续追溯：

![updateContainerAtExpirationTime](/assets/img/updateContainerAtExpirationTime.gif)

动图中的调用栈显示，updateContainerAtExpirationTime方法调用了scheduleRootUpdate。scheduleRootUpdate这个方法的作用从图中可以看到，这个方法里调用createUpdate创建了一个**Update**的数据结构。接着调用`enqueueUpdate(current, update)`，从方法的命名语义上看，是把这个update放到了current的队列里。前面已经介绍过，current是根Fiber。了解一下Fiber的数据结构就会发现，每个FiberNode上都会有一个**updateQueue**属性。(FiberNode.stateNode属性是虚拟DOM对应的实例，类似props.ref获取到的值，对于React Component就是组件实例，对于浏览器标签就是真实的DOM节点实例)

![FiberNode](/assets/img/FiberNode.png)

在深入**enqueueUpdate**之前，我们还有必要清楚的探究一下刚刚创建**Update**是什么东西，跟**FiberNode.updateQueue**有什么关系？

![Update](/assets/img/update.png)

**Update**的数据结构十分简单，记录了刚刚计算出的expirationTime，打了一个**UpdateState**的tag。没有什么新发现，接着去看**enqueueUpdate**方法，这个方法总而言之就是把刚刚创建的**Update**放进**UpdateQueue**，**UpdateQueue**的数据结构我们先了解一下：

![UpdateQueue](/assets/img/UpdateQueue.png)

然后，就开始真正的调度工作。


## scheduleWork

>enqueueUpdate中准备好了Fiber及其updateQueue，scheduleWork开始利用根纤程节点current和expirationTime开始组件树的调度工作。从大的角度看，调度流程包含requestWork、performWork、beginWork、completeWork。每一阶段都包含大量复杂逻辑。

首先，调用**scheduleWorkToRoot**找到FiberRoot并返回，每次调度都要找到RootFiber，看起来RootFiber十分不同寻常：

![scheduleWorkToRoot](/assets/img/scheduleWorkToRoot.gif)

接着**markPendingPriorityLevel**开始对上面找到的FiberRoot上一些目前看来还不知所云的属性初始化，从方法名称和标记的这些属性的名称上看，是一些优先级相关的属性，而且。但是从属性的类型上看，又跟expirationTime有千丝万缕的联系：

![markPendingPriorityLevel](/assets/img/markPendingPriorityLevel.gif)


## requestWork

![requestWork](/assets/img/requestWork.gif)


## performWork

performWork

![performWork](/assets/img/performWork.gif)

performWorkOnRoot

![performWorkOnRoot](/assets/img/performWorkOnRoot.gif)

workLoop & performUnitOfWork

workLoop开始执行之初，nextUnitOfWork已经在上一步performWorkOnRoot里的renderRoot方法中被赋值为fiber.alternate，就是新创建的那个work in progress的fiber。

![performUnitOfWork](/assets/img/performUnitOfWork.gif)


## beginWork

在beginWork里，根据fiber的workTag进入不同的渲染流程。根Fiber的workTag是HostRoot，除此之外还有：

![ReactWorkTags](/assets/img/ReactWorkTags.png)

第一次渲染，props和context都没有改变，所以直接进入HostRoot的更新流程**updateHostRoot**：

![beginWork](/assets/img/beginWork.gif)

## commitRoot(ReactFiberScheduler.js)

prepareForCommit

first pass
>The first pass performs all the host insertions, updates, deletions and ref unmounts.

root.current = finishedWork;
>the first pass of the commit phase, so that the previous tree is still current during componentWillUnmount, but before the second pass, so that the finished work is current during componentDidMount/Update.

second pass
>In the second pass we'll perform all life-cycles and ref callbacks. Life-cycles happen as a separate pass so that all placements, updates, and deletions in the entire tree have already been invoked. This pass also triggers any renderer-specific initial effects.