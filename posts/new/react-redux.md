---
title: React Redux 源码
updated: 2018-04-01
layout: 2017/blog
---

1.前言
---------
{: .-no-hide}

读完了redux的源代码，自然而然会对组件与Store如何实现订阅与刷新产生好奇。这就是`react-redux`所做的事情，通过`connect`方法构建容器组件使页面组件与数据解耦。


## 2.Provide组件
react-redux提供了一个名叫`Provider`的组件，用来包裹顶级的应用组件，向其中注入`Store`。`Provider`将`Store`放在`context`上，所以实际上所有子级组件都可以直接获取。

```
class Provider extends Component {
   // 将store放进context 
   // this.context.store = store
   // this.context.storeSubscription = null
   getChildContext() {
     return { [storeKey]: this[storeKey], [subscriptionKey]: null }
   }

   constructor(props, context) {
     super(props, context)
     // Provider作为顶层组件 从props拿到store
     this[storeKey] = props.store;
   }

   render() {
     // 确保Provider只有一个子组件（路由组件） 然后返回这个组件
     return Children.only(this.props.children)
   }
}
```

## 3.容器组件概念的基石 —— connect

`connect`在实现单向数据流时发挥着不可或缺的`管道功能`。`connect`使`Component`向`Store`订阅，然后驱动数据从`Store`流向`Component`。

在函数式编程中，分析源码最直观的办法就是寻找函数签名。`connect`函数签名如下：

```
(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    {
     pure = true,
     areStatesEqual = strictEqual,
     areOwnPropsEqual = shallowEqual,
     areStatePropsEqual = shallowEqual,
     areMergedPropsEqual = shallowEqual,
     ...extraOptions
    } = {}
    
) => connectHOC(selectorFactory, {
          methodName: 'connect',displayName from the wrapped component's displayName.
          getDisplayName: name => `Connect(${name})`,
          shouldHandleStateChanges: Boolean(mapStateToProps),
          initMapStateToProps,
          initMapDispatchToProps,
          initMergeProps,
          pure,
          areStatesEqual,
          areOwnPropsEqual,
          areStatePropsEqual,
          areMergedPropsEqual,
          ...extraOptions
     })
```

`connectHOC`函数签名如下：

```
(
    selectorFactory,
    {
        getDisplayName = name => `ConnectAdvanced(${name})`,
        methodName = 'connectAdvanced',
        renderCountProp = undefined,
        shouldHandleStateChanges = true,
        storeKey = 'store',
        withRef = false,
        ...connectOptions
    } = {}
  
) => (WrappedComponent) => class Connect extends Component{}
```

最终`connect`的签名可总结为：

```
(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps,
    {
     pure = true,
     areStatesEqual = strictEqual,
     areOwnPropsEqual = shallowEqual,
     areStatePropsEqual = shallowEqual,
     areMergedPropsEqual = shallowEqual,
     ...extraOptions
    } = {}
    
) => (WrappedComponent) => class Connect extends Component{}
```

结合我们平常的使用方式`export default connect({mapStateToProps})(Page)`可知，我们导出实际是一个上述的`class Connect extends Component{}`组件。

## 3.Connect组件

`Connect组件类`是`react-redux`的核心，也是我们所写的所有页面组件共同的父组件。

既然是一个React组件，自然有所有React组件共同的特性、生命周期。我们知道redux导致了页面组件props变化进而刷新。而`Connect组件`作为页面的父组件，本质是redux导致`Connect组件`刷新了其子组件。

```
class Connect extends React.Component {
    render() {
         return React.createElement(WrappedComponent, this.addExtraProps(selector.props))
     }
}
```
从前面`connect`函数签名可知，`WrappedComponent`是我们传入的页面组件。结合上面`Connect组件`的`render方法`，可以看出`Connect组件`渲染的实际上还是我们的页面组件，但在原来的组件上添加了新的props（React.createElement的使用方法不必细说）。所以，重中之重就是搞清楚`Connect组件`给我们的页面组件额外添加了那些props才导致页面会随着`Store`的变化重新渲染。

要搞清楚这个问题，要从`Connect组件`一开始实例化时开始。

```
class Connect extends React.Component {
   constructor(props, context) {
        this.initSelector()
        this.initSubscription()
   }
   
   initSelector() {
        const sourceSelector = selectorFactory(this.store.dispatch, selectorFactoryOptions)
        this.selector = makeSelectorStateful(sourceSelector, this.store)
        this.selector.run(this.props)
   }

   initSubscription() {
        if (!shouldHandleStateChanges) return
        const parentSub = (this.propsMode ? this.props : this.context)[subscriptionKey]
        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
        this.notifyNestedSubs = this.subscription.notifyNestedSubs.bind(this.subscription)
   }
}
```

(1) 首先执行`initSelector`。

`initSelector`调用`selectorFactory`方法，在`selectorFactory`方法中，处理了`connect({mapStateToProps})(Page)`方法传进来的mapStateToProps、mapDispatchToProps和mergeToProps。然后将这些参数再传递给`pureFinalPropsSelectorFactory`方法得到返回值`function pureFinalPropsSelector`赋值为`sourceSelector`：

```
export function pureFinalPropsSelectorFactory(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  dispatch,
  { areStatesEqual, areOwnPropsEqual, areStatePropsEqual }
) {
  let hasRunAtLeastOnce = false
  let state
  let ownProps
  let stateProps
  let dispatchProps
  let mergedProps

  function handleFirstCall(firstState, firstOwnProps) {
    state = firstState
    ownProps = firstOwnProps
    stateProps = mapStateToProps(state, ownProps)
    dispatchProps = mapDispatchToProps(dispatch, ownProps)
    mergedProps = mergeProps(stateProps, dispatchProps, ownProps)
    hasRunAtLeastOnce = true
    return mergedProps
  }

  function handleSubsequentCalls(nextState, nextOwnProps) {
    const propsChanged = !areOwnPropsEqual(nextOwnProps, ownProps)
    const stateChanged = !areStatesEqual(nextState, state)
    state = nextState
    ownProps = nextOwnProps

    if (propsChanged && stateChanged) return handleNewPropsAndNewState()
    if (propsChanged) return handleNewProps()
    if (stateChanged) return handleNewState()
    return mergedProps
  }

  // 调用selectFactory返回这个函数  (nextState, nextOwnProps) => 
  return function pureFinalPropsSelector(nextState, nextOwnProps) {
        return hasRunAtLeastOnce
          ? handleSubsequentCalls(nextState, nextOwnProps)
          : handleFirstCall(nextState, nextOwnProps)
  }
}
```

接下来`initSelector`会调用selectFactory返回的sourceSelector方法，得到了页面从store监听的state与`Connect组件`的props的并集：

```
// merge store.state and this.props
const nextProps = sourceSelector(store.getState(), this.props)
if (nextProps !== this.selector.props || selector.error) {
    this.selector.shouldComponentUpdate = true
    this.selector.props = nextProps
    this.selector.error = null
}
```
如果这个新构建的nextProps相比`Connect组件`的props发生了变化，就为`this.selector`添加以上三个属性。

调试图(size:32M)
![initSelector](/assets/img/initSelector.gif)

(2)然后执行`this.initSubscription()`

`initSubscription`方法创建了一个`Subscription`实例。
`Connect组件`在这个实例中实现了向Store订阅，向Connect通知的功能。

```
initSubscription() {
        if (!shouldHandleStateChanges) return

        const parentSub = (this.propsMode ? this.props : this.context)[subscriptionKey]
        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))

        this.notifyNestedSubs = this.subscription.notifyNestedSubs.bind(this.subscription)
 }
```
`initSubscription`在实例化Subscription时传入了第三个参数`this.onStateChange`回调函数，这个回调函数被作为一个listener传递给store，以使得store在变化时通过此函数通知`Connect组件`。

```
onStateChange() {
   this.selector.run(this.props)
   if (!this.selector.shouldComponentUpdate) {
     this.notifyNestedSubs()
   } else {
     this.componentDidUpdate = this.notifyNestedSubsOnComponentDidUpdate
     this.setState(dummyState)
   }
}
```
从`onStateChange`的实现上看，可知，每次store发生变化时，会调用`this.selector.run`方法去重新收集store.state和Connect组件的props构建nextProps，然后判断是否和props相等。

(3)Connect组件的生命周期函数

Connect组件将React组件的生命周期利用的出神入化。

```
 // 向store订阅 
 componentDidMount() {
   if (!shouldHandleStateChanges) return
   this.subscription.trySubscribe()
   this.selector.run(this.props)
   if (this.selector.shouldComponentUpdate) this.forceUpdate()
 }

 componentWillReceiveProps(nextProps) {
   this.selector.run(nextProps)
 }

 shouldComponentUpdate() {
   return this.selector.shouldComponentUpdate
 }

 componentWillUnmount() {
   if (this.subscription) this.subscription.tryUnsubscribe()
   this.subscription = null
   this.notifyNestedSubs = noop
   this.store = null
   this.selector.run = noop
   this.selector.shouldComponentUpdate = false
 }

```
