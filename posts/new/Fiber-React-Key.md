---
title: Fiber 架构下 React key 的实现原理
updated: 2019-03-10
layout: 2017/blog
intro: 深入 React 16.8 源码，深究 React Key 的每一个实现细节。
  <a target="_blank" class="tagline" href="https://www.bilibili.com/video/av48472416">→ 推荐 Vlog</a>
---

[React Key的实现原理 Vlog](https://www.bilibili.com/video/av48472416)

[React Key动画演示 Vlog](https://www.bilibili.com/video/av48347219)

[Effect List动画演示 Vlog](https://www.bilibili.com/video/av48384879)


在开始表演之前，先看一段代码：

```js
const container = document.createElement('div');
let node;

const Component = props => (
  <div ref={c => (node = c)}>
    <div key={props.swap ? 'banana' : 'apple'} />
    <div key={props.swap ? 'apple' : 'banana'} />
  </div>
);

ReactDOM.render(<Component />, container);
const origChildren = Array.from(node.childNodes);

ReactDOM.render(<Component swap={true} />, container);
const newChildren = Array.from(node.childNodes);
```

思考originChildren 与 newChildren之间的关系是怎样的？

答案是：

```js
origChildren[0] === newChildren[1]; // true
origChildren[1] === newChildren[0]; // true
```

这是一个很简单的测试用例，却足以拿来讲清楚 React 在新的 Fiber 架构中，对组件 key 做了怎样的处理。

### 从ReactDOM.render说起

React App 所挂载的 DOM 节点，是一个 React 应用的起点，是通往 React 世界的大门。
进门之后，没有特殊情况，只论 React Component，不谈 DOM Element。
ReactDOM.render 会以一种形式来宣告主权 —— 在所挂载的 DOM 上加上一个属性 `_reactRootContainer`，这个属性是 ReactRoot 的一个实例。
ReactRoot 是 React 世界真正意义上的主宰，如果所挂载的 DOM 元素上已经有了 `_reactRootContainer`，直接把组件交由它去渲染即可。
而 ReactDOM，只是 ReactRoot 的形象代言人。

基于此，两次 ReactDOM.render 中，第一次创建并挂载了 Component 组件并在 container 这个 div 节点上添加 `_reactRootContainer` 属性，第二次则仅仅是对 Component 组件进行了更新的操作。
为了保持用例的简单性，我们没有引入 class 和 hooks 便达到了改变组件 key 的目的。

以上，是我们此次探索的基础。

### 对key的解释

在组件更新时，React 需要将一个组件树转换成另一个树。
众所周知，React 在调度层面上实现了 O(n) 级别的 diff 算法 —— 不同类型的组件会产生不同树。
围绕这个理念，无论组件树的哪一级有更新，都只需要从顶级组件开始，做同级别比对，同类型组件更新，不同类型组件重建。
如果你对上一节留了心，认真研究了一下 `_reactRootContainer`，那这里可以先告诉你，调度算法就是从它的 `_internalRoot` 属性开始的。

然而，业务是纷繁复杂的，diff 算法十分脆弱。
有一种常见的场景，需要React用户协助判断，否则 React 的性能会很轻易地变成 jQuery，甚至更差。
稍有不慎，React就会帮你卸载大量DOM元素并重新构建。
Virtual DOM 相比 DOM 操作在执行速度上的优势也荡然无存。

什么时候会出现这种情况呢？官方有一个示例：

```js
<ul>
  <li>Duke</li>
  <li>Villanova</li>
</ul>

<ul>
  <li>Connecticut</li>
  <li>Duke</li>
  <li>Villanova</li>
</ul>
```

当子组件是一个数组时，由于 React 是根据数组的索引来调度更新，所以，示例中的三个 li 组件虽然只有一个发生改变，但三个组件都有更新。
还好，仅仅是更新，还没有销毁。如果不是简单的 li 标签，而是复杂而且类型不同的自定义组件呢？结果可想而知。

如何协助 React 解决这个问题？答案便是 **key**。
一个自定义组件包含有多个同级子组件，如果这些子组件的数量和顺序经常或可能发生改变（通常是使用数组渲染时），需要开发者给这些组件加上一个索引无关的变量 **key**，React 保证这些含 key 的组件，不会因为在同级子组件中所处的位置发生改变而不合理地刷新或销毁。
为什么 key 需要是索引无关？因为索引通常代表着子组件所处的位置，位置一旦改变，索引也跟着改变，用索引作为 key，等同于未设置 key。

### 含key组件的调度

让我们重新回到一开始的那个用例。
第一次执行 `ReactDOM.render`，Component 组件被挂载到 container 节点。
再次执行 `ReactDOM.render`，组件中两个同级的 `div` 的 key 均发生了改变（相互调换）。

进入第一次 ReactDOM.render，一步步探索 React 对含 key 组件做了怎样的处理。

*packages/react-dom/src/client/ReactDOM.js - Line:555*

```js
// Initial mount
root = container._reactRootContainer = legacyCreateRootFromDOMContainer(
  container,
  forceHydrate,
);
...
// Initial mount should not be batched.
unbatchedUpdates(() => {
  ...
  root.render(children, callback);
  ...
});
```

ReactDOM.render 首先为挂载的 DOM 节点创建并添加 `_reactRootContainer` 属性。
然后调用 `_reactRootContainer` 上的 render 方法开始调度流程。
调度流程的起点叫做 RootFiber，RootFiber 保存在 `_reactRootContainer` 的 `_internalRoot` 属性里，它是整个 Fiber 链表的 head。
Fiber 链表中可以拆分出多个链表，其中一个便是下图中的“组件链表”。

![Fiber Chain](https://ws3.sinaimg.cn/large/006tKfTcgy1g1mi6wxx3qj32mi0nmgz1.jpg)

如图所示，React 调度器从 RootFiber 出发，在 workLoop 循环中，逐步经过 `<Component />` 组件、div、div 下的两个子 div。

*packages/react-reconciler/src/ReactFiberScheduler.js - Line:1209*

```js
function workLoop(isYieldy) {
  ...
  // Flush work without yielding
  while (nextUnitOfWork !== null) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  ...
}
```

当 workLoop 来到 `<Component />`，由于 `<Component />` 是一个函数组件，于是，React 执行该函数，获取其渲染内容：一个 div 组件。
在 HTML 中，div 属于合法标签，React 将能够渲染成这些 HTML 合法标签的组件称作 `HostComponent`，用来挂载或更新 `HostComponent` 的方法是 updateHostComponent：

*packages/react-reconciler/src/ReactFiberBeginWork.js - Line:911*

```js
function updateHostComponent(current, workInProgress, renderExpirationTime) {
  ...
  let nextChildren = nextProps.children;
  ...
  reconcileChildren(
    current,
    workInProgress,
    nextChildren,
    renderExpirationTime,
  );
  ...
  return workInProgress.child;
}
```

在 updateHostComponent 方法中，React 从函数组件 Component 返回的 div 中取出 props.children 数组，该数组中有两个设置了 key 的 div。
然后将 children 数组交给 reconcileChildren 方法，在这个方法里，经过一系列的函数调用，来到位于 ReactChildFiber.js 文件中的 reconcileChildrenArray 方法。
在这里，我们可以找到 React 对含 key 组件的保存和更新方式。

*packages/react-reconciler/src/ReactChildFiber.js - Line:734*

```js
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<*>,
  expirationTime: ExpirationTime,
): Fiber | null {
  let resultingFirstChild: Fiber | null = null;
  let previousNewFiber: Fiber | null = null; // 遍历children数组时保存前一个fiber
  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0; //
  let newIdx = 0; // fiber.index
  let nextOldFiber = null;

  // --- ① ---
  // 初次挂载 将基于children挨个地创建fiber
  if (oldFiber === null) {
    // If we don't have any more existing children we can choose a fast path
    // since the rest will all be insertions.
    for (; newIdx < newChildren.length; newIdx++) {
      // 创建fiber
      const newFiber = createChild(
        returnFiber,
        newChildren[newIdx],
        expirationTime,
      );
      if (!newFiber) {
        continue;
      }
      // 为newFiber.index赋值
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        // 数组的成员之间 前一个成员通过sibling指向下一个成员
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild; // 返回children数组第一个fiber
  }
  ...
  ...
  return resultingFirstChild;
}
```

回顾一下前面那张 Fiber 链表图示，链表上的第三个节点 div，指向的是其第一个子组件 div。
所以，进入 reconcileChildrenArray 方法之前，我们需明确一点，方法的返回值是我们链表上的第四个节点 div。
这样，我们的 `workLoop` 才能沿着上图中的链表继续前行下去。
由此可以得知，上述代码中 `resultingFirstChild` 变量即是 children 数组中的第一个组件的 Fiber。
我们具体看一下这段代码做了什么。
第 ① 处，遍历 children 数组，调用 createChild 方法，为每一个 children 组件创建一个空的 FiberNode。
接着调用 placeChild 方法，将新创建的 FiberNode 的 index 属性赋值为 newIdx。
然后，将 children 数组中的所有组件通过 sibling 属性关联起来。
遍历完成之后，将 children 数组的第一个组件对应的那个 fiber 返回出去，回到 `workLoop`，调度沿着 Fiber 链表继续进行。

至此，第一次 ReactDOM.render 执行完成，所有的组件均已挂载，并未对含 key 的组件做任何特殊的处理。

下面进入第二次 ReactDOM.render 的执行过程。

这一次由于所挂载 DOM 节点 `container._reactRootContainer` 属性已经存在，所以不会再为挂载点重复创建和添加。
直接进入 `_reactRootContainer` 上的render方法。
再次来到 `workLoop`，同样地，再次来到了 reconcileChildrenArray 方法，这一次的 reconcileChildrenArray 方法内将执行另外一段与第一次 render 时完全不同的逻辑：

*packages/react-reconciler/src/ReactChildFiber.js - Line:734*

```js
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<*>,
  expirationTime: ExpirationTime,
): Fiber | null {
  let resultingFirstChild: Fiber | null = null;
  let previousNewFiber: Fiber | null = null; // 遍历children数组时保存前一个fiber
  // currentFirstChild在更新时不为空 为旧children数组的第一个组件的fiber
  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0; //
  let newIdx = 0; // fiber.index
  let nextOldFiber = null;
  ...
  ...
  // --- ② ---
  // 遍历新的children数组
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      nextOldFiber = oldFiber.sibling;
    }
    // 循环判断newChildren中的组件与相同索引的旧组件 key是否相同
    // 相同则直接基于oldFiber创建newFiber
    // 循环中一旦遇到新旧组件key值不同 立即跳出该循环
    const newFiber = updateSlot(
      returnFiber,
      oldFiber,
      newChildren[newIdx],
      expirationTime,
    );
    if (newFiber === null) {
      // TODO: This breaks on empty slots like null children. That's
      // unfortunate because it triggers the slow path all the time. We need
      // a better way to communicate whether this was a miss or null,
      // boolean, undefined, etc.
      if (oldFiber === null) {
        oldFiber = nextOldFiber;
      }
      break;
    }
    ...
    ...
  }

  // Add all children to a key map for quick lookups.
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

  // --- ③ ---
  // Keep scanning and use the map to restore deleted items as moves.
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx],
      expirationTime,
    );
    if (newFiber) {
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          // The new fiber is a work in progress, but if there exists a
          // current, that means that we reused the fiber. We need to delete
          // it from the child list so that we don't add it to the deletion
          // list.
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key,
          );
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
  }

  if (shouldTrackSideEffects) {
    // Any existing children that weren't consumed above were deleted. We need
    // to add them to the deletion list.
    existingChildren.forEach(child => deleteChild(returnFiber, child));
  }

  return resultingFirstChild;
}
```

首先，第 ② 处 for 循环，遍历新的 children 数组。在 updateSlot 方法内判断，更新中的组件与相同索引的旧组件的 key 值是否相同，相同则直接为新的组件创建新的 FiberNode；一旦遇到不同，立即跳出循环。
将 newChildren 中剩余的组件交给第 ③ 处的循环。

*packages/react-reconciler/src/ReactChildFiber.js - Line:522*

```js
function updateSlot(
  returnFiber: Fiber,
  oldFiber: Fiber | null,
  newChild: any,
  expirationTime: ExpirationTime,
): Fiber | null {
  // Update the fiber if the keys match, otherwise return null.
  const key = oldFiber !== null ? oldFiber.key : null;
  ...
  ...
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        if (newChild.key === key) {
          ...
        } else {
          return null; // 无相同key 返回null
        }
      }
    }
    ...
    ...
  }
  return null;
}
```

在我们的用例中，由于 newChildren 数组中两个组件互相交换了 key，所以遍历 newChildren 时，找不到相同索引且相同 key 的旧组件，直接跳过第 ② 处的循环，Fiber 链表中的两个含 key 的 FiberNode 都会来到第 ③ 处循环。
进入第 ③ 处循环之前，先执行 mapRemainingChildren 方法，将含 key 的 oldFiber 保存在一个 `Map` 中。这个 `Map` 是第 ③ 处循环更新 newChildren 中剩余组件的重要依据。

*packages/react-reconciler/src/ReactChildFiber.js - Line:281*

```js
function mapRemainingChildren(
  returnFiber: Fiber,
  currentFirstChild: Fiber,
): Map<string | number, Fiber> {
  // Add the remaining children to a temporary map so that we can find them by
  // keys quickly. Implicit (null) keys get added to this set with their index
  // instead.
  const existingChildren: Map<string | number, Fiber> = new Map();

  let existingChild = currentFirstChild;
  while (existingChild !== null) {
    if (existingChild.key !== null) {
      existingChildren.set(existingChild.key, existingChild);
    } else {
      existingChildren.set(existingChild.index, existingChild);
    }
    existingChild = existingChild.sibling;
  }
  return existingChildren;
}
```

mapRemainingChildren 方法将两个含 key 的 FiberNode 以 `[key || fiber.index]: fiber` 的形式放进 existingChildren 这个 `Map` 中，并将 `Map` 返回。
上面在第一次 render 的流程中已经对 `fiber.index` 做了阐述，这里不再重复解释。

构建完 existingChildren，开始新的一轮遍历。React 更新组件实际上是为更新后的组件数组 newChildren 中的每一个组件创建新的 FiberNode，并使它们之间通过 sibling 属性链接成新的 Fiber 链表。

进入第 ③ 处 for 循环，由于第 ② 处循环可能已经对 newChildren 数组做了处理，所以，这里的 newIdx 并不一定是从 0 开始，毕竟从第 ② 处循环结束后，我们便只是在处理 newChildren 数组中余下的组件。
但在我们的用例中，此时的 newIdx 仍然为0，因为我们 newChildren 数组中的每个组件的 key 都发生了改变，而第 ② 处循环并没有做任何处理。明确了这些，我们开始进入 updateFromMap 方法。

*packages/react-reconciler/src/ReactChildFiber.js - Line:610*

```js
function updateFromMap(
  existingChildren: Map<string | number, Fiber>,
  returnFiber: Fiber,
  newIdx: number,
  newChild: any,
  expirationTime: ExpirationTime,
): Fiber | null {
  ...
  ...
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        const matchedFiber =
          existingChildren.get(
            newChild.key === null ? newIdx : newChild.key,
          ) || null;
        ...
        ...
        return updateElement(
          returnFiber,
          matchedFiber,
          newChild,
          expirationTime,
        );
      }
    }
    ...
    ...
  }

  return null;
}
```

updateFromMap 的字面意思是根据在 mapRemainingChildren 方法中创建的 existingChildren 这个 `Map` 来更新组件。
而我们在前面已经说明，React 更新组件是为 newChildren 数组中的组件创建相应的新的 FiberNode。
所以，updateFromMap 方法所做的事情就是从 existingChildren 中取出 `newChild.key` 对应的 value —— 旧组件对应的 oldFiber，然后在 updateElement 方法中基于这个 oldFiber 创建 newFiber，同时将 oldFiber 上的 `child`、`memoizedProps` (旧组件的props)、`memoizedState` (旧组件的state)、`index` 等属性拷贝到 newFiber 上，最后将 newFiber 返回，实现 Fiber 链表的 FiberNode 更新。
从 updateFromMap 返回 newFiber 后，还将调用 `existingChildren.delete(newFiber.key)`，把刚才找到的那个 `key:fiber` 从 existingChildren 中移除。

第③处循环结束后，完成 newChildren 数组中所有组件的“更新”，清空 existingChildren。

由于两个新组件的 key 在 existingChildren 都可以找到对应的值，而且没有其他的属性变动，所以，两个组件都没有发生其他的副作用？
看似是这样，但是他们更新到 DOM 上的位置将会发生变动，两个元素将会调换位置，这也是一种副作用，这种副作用在 React 中叫做 `Placement`。
只有完成对每个Fiber的 `Placement` 副作用进行处理，才能达到如下我们的用例期望的结果：

```js
origChildren[0] === newChildren[1]; // true
origChildren[1] === newChildren[0]; // true
```

让我们再次回到第 ③ 处的循环中，在调用 updateFromMap 方法得到新的 FiberNode 之后，有一段代码：

```js
if (newFiber) {
  // --- ⑤ ---
  if (shouldTrackSideEffects) {
    if (newFiber.alternate !== null) {
      existingChildren.delete(
        newFiber.key === null ? newIdx : newFiber.key,
      );
    }
  }
  // --- ⑥ ---
  lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
  ...
  ...
}
```

其中第 ⑤ 处的逻辑已经明确，是从 existingChildren 这个 `Map` 中删除 `key:fiber`。
而第 ⑥ 处代码即表示，在 newChildren 数组的循环中，检查每一个 newChildren 中的组件的位置有没有发生变动。
如果发生变动，就在这个这个组件对应的 Fiber 节点 —— newFiber 的 `effectTag` 属性上打一个 `Placement` 的标签。

*packages/react-reconciler/src/ReactChildFiber.js - Line:316*

```js
function placeChild(
  newFiber: Fiber,
  lastPlacedIndex: number,
  newIndex: number,
): number {
  newFiber.index = newIndex;
  ...
  ...
  const current = newFiber.alternate;
  if (current !== null) {
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // This is a move.
      newFiber.effectTag = Placement;
      return lastPlacedIndex;
    } else {
      // This item can stay in place.
      return oldIndex;
    }
  }
  ...
  ...
}
```

placeChild 函数在遍历新组件的 for 循环中执行。
oldIndex 是本轮循环从 existingChildren 中取出的 fiber 的 index，lastPlacedIndex 是上一轮循环从 existingChildren 中取出的 fiber 的 index。
如果这次取出的 fiber 的 index 小于上一次取出的 fiber 的 index，说明在当前页面上，这次取出的 fiber 所映射的 DOM，位于上一次取出的 fiber 所映射的 DOM 前面。
React 认为这种不是严格按照旧的 children 数组的索引顺序复用的 fiber 是有副作用的。
commit 阶段会把有副作用的取出来，重新找位置插入。
这个例子里，就是把 apple 取出来，重新 append 到父级的 div。

在我们的用例中，第一个含 key 组件并没有副作用，第二个含 key 组件将会在commit执行 `Placement` 的副作用。

到这里，React 对同级别多个含 key 组件的调度流程，就基本结束了。

### 条件渲染

[条件渲染](https://reactjs.org/docs/conditional-rendering.html)是一种“表达式组件”。
在一个 React 组件中，我们可以通过表达式来动态控制，选择性地渲染部分子组件。

再看一个示例：

```js
const container = document.createElement('div');

const Component = props => (
  <App>
    {props.swap && <Header />}
    <Content />
  </Ap>
);

ReactDOM.render(<Component />, container);
ReactDOM.render(<Component swap={true} />, container);
```

思考 `<Content />` 组件有没有更新？

示例中，两次渲染树分别为：

```js
<App>
  <Content />
</App>

<App>
  <Header />
  <Content />
</App>
```

参考上一部分我们对数组渲染的解释，这里的 `<Content />` 组件在更新中变成了 `<Header />` 组件，React会为我们卸载 `<Content />` 然后挂载 `<Header />`，最后再创建并插入一个新的 `<Content />`。

而答案是：没更新。

`<Component />` 组件初次挂载时和更新后，`<App />` 组件 props.children 的值分别为：

```js
[
  undefined,
  { type: Content }
]

[
  { type: Header },
  { type: Content }
]
```

调度子组件数组时，如果数组中的成员不包含 key，React 会通过 `fiber.index` 记住组件在当前列表中的位置索引，并在后续更新时，仅仅对相同索引的组件做 diff 运算。
所以，由于表达式的运算结果 `undefined` 成为了一个占位（渲染时被忽略），`<Content />` 组件上并没有发生任何副作用。这便是为什么 React 官方文档上会说：

>If you choose not to assign an explicit key to list items then React will default to using indexes as keys.

### Immutable Fiber And Mutable DOM

组件的每一次渲染，都会创建新的 Fiber 和 ReactElement，但是会在原来的 Component 和 DOM 上做修改，这种修改叫做 effect。
用简单对象 Fiber 和 ReactElement 的频繁销毁与重建，屏蔽了复杂对象 Component 和 DOM 的销毁与重建。
