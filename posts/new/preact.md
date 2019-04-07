---
title: Preact 源码
updated: 2018-03-09
layout: 2017/blog
---

1.preact运行流程图
---------
{: .-no-hide}

![preact](/assets/img/preact渲染流程.png)

## 2.从h()函数开始
本质上jsx代码是不符合js语法规则的。所以在程序运行之前要做的第一件事就是将jsx转换成真正可执行的js。这边是h()函数的作用。

在使用react的时候，多数人察觉不到这一点，因为安装了babel-preset-react之后babel会自动转换jsx，使用的是react中的createElement()函数。相应的，在preact中使用的是h函数。你也可以像在react中使用React.createElement函数一样使用Preact.h()函数手动创建组件。

写一个最简单的组件，从render()函数开始调试。看看preact的实现原理。

```
import { render, h, Component } from 'preact'
import Demo from './src/module/demo'

class App extends Component{
    constructor(props) {
        super(props)
    }

    render() {
        return (
            <div>
                <div>demo container</div>
                <Demo />
            </div>
        )
    }
}
render(<App/>, document.getElementById('app'))
```
上述jsx代码被babel转换为

```
// App 组件的es5形式
var App = function (_Component) {
  _inherits(App, _Component);
  
  function App(props) {
    _classCallCheck(this, App);
  
    return _possibleConstructorReturn(this, (App.__proto__ || Object.getPrototypeOf(App)).call(this, props));
  }
  
  _createClass(App, [{
    key: "render",
    value: function render() {
      return (0, _preact.h)(
        "div",
        null,
        (0, _preact.h)(
          "div",
          null,
          "demo container"
        ),
        (0, _preact.h)(_demo2.default, null)
      );
    }
  }]);
  return App;
}(_preact.Component);

// 我们配置的babel-plugin-transform-jsx已经将jsx转换成可执行的preact的h()函数了
(0, _preact.render)((0, _preact.h)(App, null), document.getElementById('app'));
```

继续往下跟就会进入`h(App, null)`函数

```
// 简化一下
// render(h(App, null), document.getElementById('app'))
(0, _preact.render)((0, _preact.h)(App, null), document.getElementById('app'));
```

h()函数的调试过程如下，nodeName会被赋值为组件App函数。children为空数组，回头看看我们的jsx可以发现`<App/>`确实没有任何子元素。
![h](/assets/img/h函数调试.gif)
下面是我调试后所做的源码注释：

```
import { VNode } from './vnode';
import options from './options';

const stack = [];
const EMPTY_CHILDREN = [];

// h函数把 babel从jsx转换出来对象 转换成虚拟dom对象VNode
// 在babel配置中把pragma配置为h函数 默认为React.createElement （https://www.npmjs.com/package/babel-plugin-transform-react-jsx）
// 再在diff方法中调用buildComponentFromVNode把VNode渲染为真实的dom
export function h(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	// 第3、4、5等个参数全部放进stack数组(子组件或子文本)
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	// props.children如果存在也放进stack数组 删掉props.children属性
	// 支持children不以jsx方式写 而是把children作为父组件的一个props.children
	if (attributes && attributes.children!=null) {
		if (!stack.length)
			stack.push(attributes.children);
		delete attributes.children;
	}
	// 前面所有children放进了stack
	// 这里遍历stack为vnode构建vnode.children
	while (stack.length) {
		// 数组child (可能是数组、对象、VNode实例，还有可能是字符串)
		// ① <div>{obj}</div>							会被转成h('div', null, {obj})
		// ② <div>{[obj1, obj2]}</div>					会被转成h('div', null, {[obj1, obj2]})
		// ③ <div>节点1<span>节点2</span>节点3</div> 	会被转成h('div', null, '节点2', h('span', null, '节点2'), '节点3')

		// 第③种情况 遍历这个数组并把child都放进stack 然后继续给while去循环pop出来
		// 比如一个组件有三个child 第三个是有一个有五个组件的数组 则循环到第三次时stack.length = 0
		// 然后进入这一段代码 stack.length = 5了
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		else {
			if (typeof child==='boolean') child = null;

			// 如果nodeName是function child不在这里处理 renderComponent里面还要实例化nodeName
			// 如果nodeName不是function 才在这里处理
			if ((simple = typeof nodeName!=='function')) {
				if (child==null)
					child = '';
				else if (typeof child==='number')
					child = String(child);
				// 如果child不是boolean、number、string 也就是无法渲染为文本节点
				// simple就设为false
				else if (typeof child!=='string')
					simple = false;
			}

			// child是string 添加到最后一个组件内
			// 否则push进children
			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			else {
				// child是VNode实例 simple为false
				children.push(child);
			}

			// lastSimple是上次循环中simple的值
			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode!==undefined) options.vnode(p);

	return p;
}

```

接下来就会进入`h(App, null)`函数外层的`Preact.render()`函数，相当于`ReactDOM.render()`。这个函数里实际上什么都没做，只是把参数都传给了另一个重要的函数`diff`。

```
// 参数 
// @vnode 	react根组件 
// @parent 	dom根节点
export function render(vnode, parent, merge) {
	return diff(merge, vnode, {}, false, parent, false);
}
```

稍微了解一点react的都知道，virtualDom就是依赖时间复杂度只有O(n)的diff算法才实现高效的渲染工作的。下面就去看一看它是如何实现的。

## 3.diff函数

在此之前，强烈建议大家看看react官网的[reconciliation](https://reactjs.org/docs/reconciliation.html)这一篇文章，里面详细介绍了diff算法的设计思想、遇到的问题和解决方案。简单总结一下：

- react只对同层级的virtual DOM节点做对比，如果节点类型不同，直接移除原节点，挂载新节点。
- 节点相同则对props属性做修改，然后迭代diff其子节点。
- 多个字节点通过节点key值比对。key值不存在则创建新节点，key存在的diff新旧树上具有相同key的节点。

简单介绍背后的设计理念，下面开始调试环节。
![h](/assets/img/diff函数调试.gif)

可见diff把任务都交给了idiff处理。继续进入idiff中一探究竟。

## 4.idiff函数

判断要渲染的虚拟DOM的类型，进行相应的渲染流程，主要分为三种情况：`文本节点diff流程`，`类或函数组件diff流程`，`标签组件diff流程`。

![idiff](/assets/img/idiff.png)

```
function idiff(dom, vnode, context, mountAll, componentRoot) {
    
    // ①
    // vnode为null或boolean类型  渲染空字符
    if (vnode == null || typeof vnode === 'boolean') vnode = ''
    // vnode为string或number类型 渲染字符串
    if (typeof vnode === 'string' || typeof vnode === 'number') {}
    
    // ②
    // vnode为用户定义组件
    var vnodeName = vnode.nodeName;
    if (typeof vnodeName === 'function') {
        return buildComponentFromVNode(dom, vnode, context, mountAll);
    }
}
```

除上述两种情况，最后一个最重要的需要diff的组件类型，那就是浏览器本身支持的DOM标签。所有的用户定义组件最终都要渲染成浏览器支持的HTML标签，而在此之前，先要解析出组成这些组件的标签组件如div、span等等。：


```
// vnode为div、span等标签组件时进入这段diff流程
if (!dom || !isNamedNode(dom, vnodeName)) {
    // 调用document.createElement创建DOM 
	out = createNode(vnodeName, isSvgMode);
	if (dom) {
		// move children into the replacement node
		while (dom.firstChild) out.appendChild(dom.firstChild);

		// if the previous Element was mounted into the DOM, replace it inline
		if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

		// recycle the old element (skips non-Element node types)
		recollectNodeTree(dom, true);
	}
}
```

如果之前dom并不存在(首次渲染或新增组件)或更新组件时发现真实dom与虚拟dom类型不一样(例如第一次渲染div setState后渲染为span)，就要进入这个重新构建DOM的流程。利用`document.createElement`方法将`VNode`根据`vnode.nodeName`渲染为HTML结构。如果为后者，还要先将原来的DOM卸载掉。卸载流程是先调用旧组件的unmount生命周期方法，然后移除dom本身。


这不算完，diff标签组件的主要内容是diff其子组件，最后diff其本身的各个属性(attribute)。接下来就要先进入标签组件的子级组件的diff流程。
如果子级组件是文本节点，且文本值发生了变化，就直接方便地将组件的子节点赋值给dom的子节点就行了。如果不是，就进入`innerDiffNode`流程。

```
let fc = out.firstChild,
	props = out[ATTR_KEY],
	vchildren = vnode.children;

if (props==null) {
	props = out[ATTR_KEY] = {};
	// out.attributes是dom节点的属性集合 例如style class id dataset这些属性都可以在attributes中取得
	// 把这些属性键值对都放到props里面
	for (let a=out.attributes, i=a.length; i--; )
		props[a[i].name] = a[i].value;
}

// 如果vchildren是一个文本节点 直接赋值 不用像else里面一样对vchildren进行innerDiffNode
if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
	// fc就是dom元素的fistChild元素 此时是文本节点 直接将其nodeValue设为文本
	if (fc.nodeValue!=vchildren[0]) {
		fc.nodeValue = vchildren[0];
	}
}
// otherwise, if there are existing or new children, diff them:
else if (vchildren && vchildren.length || fc!=null) {
	// 在一个DOM元素内的VNode的diff out是父元素dom节点
	innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
}
```

## 5.innerDiffNode —— 组件key的黑魔法

`innerDiffNode`是React DOM diff算法的核心。如下图所示，`innerDiffNode`与idiff互相递归调用。`innerDiffNode`所实现的功能就是我们很熟悉的一个React特性，`组件key`。在React中，如果组件的key值发生变化，那么在下一轮渲染中不管有没有props变化，该组件都要刷新；如果两棵树下有相同key的子组件，那这两个子组件一定放在一起进行diff。

![innerDiff](/assets/img/innerDiff.jpg)


在`innerDiffNode`中，首先将上一次渲染出来的dom分成有key值和无key值分开保存。

```
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {

    let originalChildren = dom.childNodes,			// 原dom
		children = [],								// 无key的旧dom节点数组
		childrenLen = 0,							// 无key的旧dom节点个数
		keyed = {},									// 有key的旧dom节点对象{key: child}
		keyedLen = 0,								// 有key的旧dom节点个数
		len = originalChildren.length,				// 旧dom总个数
		vlen = vchildren ? vchildren.length : 0,	// 新组件个数
		min = 0,									
		j, c, f, vchild, child;

	// 遍历旧dom 分离成有key和无key
	if (len!==0) {
		for (let i=0; i<len; i++) {
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? child._component ? child._component.__key : props.key : null;
			// key存在 保存在keyed对象
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			// key不存在 保存在children数组
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}
}
```

然后遍历传进来的要渲染的子组件，就是常说的`props.children`。当组件有key时，去保存着含key旧dom对象keyed中找到同key的旧dom，然后将旧dom赋值给child拿去跟vchild通过递归调用diff方法比对。组件没key时，去保存着不含key的旧dom数组children中挨个寻找同类的节点(找不到默认为null)，然后同样递归调用diff方法比对旧dom(或null)和新组件。至此又回到了之前分析过的流程。

```
for (let i=0; i<vlen; i++) {
	vchild = vchildren[i];
	child = null;

	// attempt to find a node based on key matching
	let key = vchild.key;
	// 组件有key时
	if (key!=null) {
		// 找到同key的旧dom  将旧dom赋值给child拿去跟vchild比对
		if (keyedLen && keyed[key]!==undefined) {
			child = keyed[key];
			keyed[key] = undefined;
			keyedLen--;
		}
	}
	// 组件没key时
	// 去没key的旧dom数组children中挨个找同类的节点
	// attempt to pluck a node of the same type from the existing children
	else if (!child && min<childrenLen) {
		for (j=min; j<childrenLen; j++) {
			if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
				child = c;
				children[j] = undefined;
				if (j===childrenLen-1) childrenLen--;
				if (j===min) min++;
				break;
			}
		}
	}

	// morph the matched/found/created DOM child to match vchild (deep)
	// 循环且递归递归diff所有子VNode 深度优先
	child = idiff(child, vchild, context, mountAll);

	// 原来的dom变量下的子节点 第一次创建节点时originalChildren为空
	f = originalChildren[i];
	if (child && child!==dom && child!==f) {
		// 如果原来没有这个节点 append进去
		if (f==null) {
			dom.appendChild(child);
		}
		else if (child===f.nextSibling) {
			removeNode(f);
		}
		else {
			dom.insertBefore(child, f);
		}
	}
}
```

diff完子组件，才开始diff组件本身的属性props。

```
diffAttributes(out, vnode.attributes, props);
```

## 6.buildComponentFromVNode —— 自定义组件变DOM

![buildComponentFromVNode](/assets/img/buildComponentFromVNode.png)

```
export function buildComponentFromVNode(dom, vnode, context, mountAll) {
	// 第一次渲染时或新建组件节点时 dom不存在
	let c = dom && dom._component, // dom._component是保存在真实dom上的相应React组件实例
		originalComponent = c,
		oldDom = dom,
		// 要渲染的vnode与上次渲染的vnode是否相同
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName, 
		// （） => <WrapCom />用得到
		isOwner = isDirectOwner,
		props = getNodeProps(vnode); // 构造vnode的props 包括props.children
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		// 组件根节点不同直接卸载
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			// 卸载后本节点do置空
			dom = oldDom = null;
		}
		// 组件不存在 根据组件类创建组件实例即Component实例
		c = createComponent(vnode.nodeName, props, context);

		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		// 调用组件的willMount
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		// 组件根节点不同直接卸载
		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}
```

如果要渲染的vnode没变，直接调用`setComponentProps`将新组件的props**异步更新**到dom上就可以了。否则，要调用原来组件的卸载生命周期方法然后根据vnode重新**同步**创建组件实例，最后将新的props更新到新创建的组件实例上。

## 7.createComponent创建Component实例

```
export function createComponent(Ctor, props, context) {
	let inst;

	// 根据组件class创建实例inst 例如
	// class ListView extends... {
	//		render() { return <div><Item></Item></div> }
	// }
	// <ListView />变成<div><Item></Item></div>
	if (Ctor.prototype && Ctor.prototype.render) {
		// 创建组件实例 并将props交给实例的props属性
		// 因为每个实例都是继承Component的 所以这里inst已经是一个Component实例
		// 新创建的Component实例其组件的_dirty属性是true
		inst = new Ctor(props, context);
		// 同样的作用 
		// 如果是类组件 会继承Component 但函数组件不会继承 所以在这里手动继承Component函数
		Component.call(inst, props, context);
	}
	// 纯函数组件
	else {
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}
	// 返回组件实例
	return inst;
}
```


## 8.setComponentProps —— 调用组件声明周期传递props并刷新组件


```
export function setComponentProps(component, props, opts, context, mountAll) {

   // 未挂载则调用willMount
   if (!component.base || mountAll) {
        if (component.componentWillMount) component.componentWillMount()
   }
   // 已挂载则调用willReceiveProps
   else if (component.componentWillReceiveProps) {
        component.componentWillReceiveProps(props, context)
   }
	
	// 把component.props赋值给prevProps 把传进来的props作为component.props
	if (!component.prevProps) 
	   component.prevProps = component.props;
	component.props = props;
	
	
	// 前面已经调用了willMount/willReceiveProps 下面进入真正的render阶段
	if (opts!==NO_RENDER) {
		// 第一次挂载、新创建组件都是同步渲染操作，直接调用renderComponent
		if (opts===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		// 更新组件都是异步操作，放进渲染队列，等待next tick进行渲染
		else {
			enqueueRender(component);
		}
	}
}	
```

## 9.renderComponent —— 渲染组件

renderComponent时刷新组件的核心方法。方法首先声明了众多变量。

```
export function renderComponent(component, opts, mountAll, isChild) {
    let props = component.props,							// 组件新的props
		state = component.state,							// 组件新的state
		context = component.context,						// 组件新的context
		previousProps = component.prevProps || props,		// 组件旧的props
		previousState = component.prevState || state,		// 组件旧的state
		previousContext = component.prevContext || context,	// 组件旧的context
		isUpdate = component.base,							// 组件旧dom
		nextBase = component.nextBase,						// 
		initialBase = isUpdate || nextBase,					// 
		initialChildComponent = component._component,		// render(){return <WrapComp></WrapComp>}
		skip = false,										// shouldComponentUpdate返回false时跳过渲染的标记
		rendered, inst, cbase;
}
```

如果旧DOM存在说明这个组件已经挂载，已经挂载的组件更新的生命周期是`shouldComponentUpdate`、`componentWillUpdate`。下面这段代码做的就是回调组件生命周期。这是渲染前的准备工作，真正的渲染是调用组件的`render`方法。

```
 if (isUpdate) {
	// 调用生命周期函数shouldComponentUpdate和componentWillUpdate之前
	// component的props、state、context都还是prev的
	component.props = previousProps;
	component.state = previousState;
	component.context = previousContext;
	// 如果并非调用forceUpdate 且shouldComponentUpdate返回false 跳过下面的component.render
	if (opts!==FORCE_RENDER
		&& component.shouldComponentUpdate
		&& component.shouldComponentUpdate(props, state, context) === false) {
		skip = true;
	}
	// 如果shouldComponentUpdate没有返回false 或forceUpdate
	// 调用component.componentWillUpdate
	else if (component.componentWillUpdate) {
		component.componentWillUpdate(props, state, context);
	}
	// 调用生命周期函数shouldComponentUpdate和componentWillUpdate之后
	// 将component的props、state、context变成新的
	// 这样在前面两个生命周期函数中取this.state、this.props还是旧的
	// state在设置的时候就已经更新了 不会有react中的setState多次只有一次效果的情况
	component.props = props;
	component.state = state;
	component.context = context;
}
```

如果`shouldComponentUpdate`没有返回false，进入真正的渲染流程。首先调用组件render方法，这里是我们编写组件代码时着墨最多的地方，看看Preact怎么处理它。`component.render`方法的返回值是`h()`处理的结果`VNode实例`。如下图：

```
if (!skip) {
   // 调用组件原型上的render()方法 传去props state和context
	// render()方法就是返回h()调用结果 即VNode实例
	// 这一次render只会在直接子级组件上调用h()函数
	// （！！！）孙子级不会表现出来 因为自己VNode的nodeName是组件类 并没有实例化

	// 最终返回的是一个children为VNode实例数组的VNode实例 { children: [...VNode] }: VNode
	// 最顶级的VNode是一般是div  也有可能是另一个组件函数 { nodeName: function WrapperComponent(){} }
	// 例如class App extends Component{ render(){ return <WrapperComponent /> } }
	rendered = component.render(props, state, context);
	
	// 渲染后得到的组件 即父组件render方法的返回值 VNode类型
	//下面又要根据nodeName的类型进行递归diff了类似在上面idiff函数中所做的处理
	let childComponent = rendered && rendered.nodeName
	
	// 类似这种情况class App extends Component{ render(){ return <WrapperComponent /> } }
	if (typeof childComponent==='function') {
	       let childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor===childComponent && childProps.key==inst.__key) {
				// 最后一个参数传false 不是挂载 已经挂载完成
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			}
			else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				// 一个组件的render方法返回的组件结构中根组件是组件类时 这个根组件的_parentComponent就被设置为这个组件本身
				inst._parentComponent = component;
				// 传NO_RENDER是说跳过setComponentProps中的renderComponent
				// 本函数下一步会renderComponent
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				// 渲染组件
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
	} else {
	  cbase = initialBase;
	  if (initialBase || opts===SYNC_RENDER) {
			if (cbase) cbase._component = null;
			// 递归子节点VNode 返回子节点的真实dom
			// 入口的render方法是把App组件变成Component实例 然后进入这renderComponent函数里递归渲染子组件
			// 待子组件VNode的nodeName都被实例化成Component实例之后一一渲染完成 App组件也就渲染完成了
			base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
		}
	}
}
```

![componentRender](/assets/img/componentRender.png)

可以明白，我们的`renderComponent`在调用组件render方法得到vnode之后**(一定是nodeName为普通标签的vnode)**还是要交给diff方法，然后进入`innerDiffNode`去对比每一个子组件。最终所有的组件都会还原成为本来的面目——普通的jsx标签，因为只有普通的标签才能被创建为真实的DOM。这个还原的过程就是由👆第五条`innerDiffNode`方法实现的。

## 10.enqueueRender —— 渲染队列异步渲染组件

把component标记为dirty放进items数组。`items.push(component)==1`意味着只有在第一个要刷新的组件被放进来时异步调用一次`rerender`，为什么？因为是**异步调用**，而在目前的函数栈中无论往items数组中放进多少组件，next tick只需要执行一次`rerender`就能遍历items中所有的组件刷新了。

```
let items = [];
export function enqueueRender(component) {
	// 把非dirty得component插进来并标记为dirty 放进items数组(数组必须是空数组)
	// 且items.push(component)==1意味着只有在第一个要刷新的组件放进来时调用一次
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		// event loop下一次tick执行rerender方法
		(options.debounceRendering || defer)(rerender);
	}
}
```


## 11.rerender —— 遍历组件队列并更新组件

此函数是在next tick中调用的，items就是上面`enqueueRender`存放`dirty组件`的那个数组队列，代表着这一次调用栈内要更新的所有组件实例。对这些`dirty组件`，挨个循环执行renderComponent进行渲染。遍历时会判断其_dirty是否为true，因为在前几次循环中可能已经把这个组件更新过，更新过就会置_dirty为false，那这次循环就直接跳过了。如此就回到了👆第九条。

```
// 
// next tick到来之后
export function rerender() {
	let p, list = items;
	items = [];
	// 遍历调用renderComponent
	// 注意：先push的后更新
	while ( (p = list.pop()) ) {
		// 这里判断一下_dirty是否为true
		// 因为在前几次循环中可能已经把这个组件更新过，更新过就会置_dirty为false
		// 这次循环就直接跳过了 因为组件已经被更新
		if (p._dirty) 
			renderComponent(p);
	}
}
```

## 12.当setState被调用时

与React类似，Component是每一个Preact组件的父类，其定义如下：

```
export function Component(props, context) {
	this._dirty = true;
	this.context = context;
	this.props = props;
	this.state = this.state || {};
}

// 给Component添加原型方法
// Component类就包括上面几个属性
// 和setState forceUpdate render三个原型方法
extend(Component.prototype, {
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) 
			this.prevState = extend({}, s);
		   // 将新state合并到组件的state属性上
		   extend(s, typeof state==='function' ? state(s, this.props) : state);
		   if (callback) 
			  (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		   enqueueRender(this);
	},

	forceUpdate(callback) {
		if (callback) 
			(this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		renderComponent(this, FORCE_RENDER);
	},

	render() {}
});
```

当我们在组件内调用setState时，页面重新渲染。setState中最主要的一个方法就是`enqueueRender(this)`，把这个调用了setState函数的组件本身放进要刷新的组件队列中，也就是👆第十条内容。`enqueueRender`把要刷新的组件放进数组`items`中，然后异步调用了`rerender`方法，也就是在next tick中进行组件刷新。这里要注意的是，`enqueueRender`只会在第一次把组件放进队列是调用`rerender`，因为这是异步调用，在`event loop`事件队列真正执行`rerender`之前，我们可能会把若干个要刷新的组件放进`items`数组中。所以只需要在第一次调用一下`rerender`，next tick之前放进`items`中的所有组件最终都会被`rerender`执行。Preact的`setState`与React的`setState`不同的一点是Preact每次调用`setState`之后`this.state`会立即发生改变。从下图也可以看出：Preact的setState是同步更新`this.state`，异步更新组件。

![setState](/assets/img/setState.png)

```
// items代表这一次调用栈内要更新的所有组件实例的数组
// next tick到来之后挨个循环执行renderComponent 一次性渲染所有dirty组件
export function rerender() {
	let p, list = items;
	items = [];
	// 遍历调用renderComponent
	// 注意：先push的后更新
	while ( (p = list.pop()) ) {
		// 这里判断一下_dirty是否为true
		// 因为在前几次循环中可能已经把这个组件更新过，更新过就会置_dirty为false
		// 这次循环就直接跳过了 因为组件已经被更新
		if (p._dirty) 
			renderComponent(p);
	}
}
```

## 13.setAccessor —— 组件diff完成之后

组件diff完成之后才开始diff组件的props。

```
// @dom     新dom                    // 新dom
// @attrs   vnode.attributes        // 新组件props
// @old     旧dom['__preactattr']    // 旧组件props
function diffAttributes(dom, attrs, old) {
	let name;
	// remove attributes no longer present on the vnode by setting them to undefined
	// 遍历旧组件props 从中移除attrs中不存在的属性
	// setAccessor接受的参数是：
	/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
     *	If `value` is `null`, the attribute/handler will be removed.
     *	@param {Element} node	   An element to mutate
     *	@param {string} name	    The name/key to set, such as an event or attribute name
     *	@param {any} old	        The last value that was set for this name/node pair
     *	@param {any} value	      An attribute value, such as a function to be used as an event handler
     *	@param {Boolean} isSvg	  Are we currently diffing inside an svg?
     *	@private
     */
	for (name in old) {
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	// 遍历attrs old中不存在的设置到old中 old其实就是props
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}
```


```
/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	   An element to mutate
 *	@param {string} name	    The name/key to set, such as an event or attribute name
 *	@param {any} old	        The last value that was set for this name/node pair
 *	@param {any} value	      An attribute value, such as a function to be used as an event handler
 *	@param {Boolean} isSvg	  Are we currently diffing inside an svg?
 *	@private
 */
export function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') name = 'class';


	// props.key
	if (name==='key') {
		// ignore
	}
	// props.ref
	else if (name==='ref') {
		if (old) old(null);
		if (value) value(node);
	}
	// props.className
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	// props.style
	else if (name==='style') {
		if (!value || typeof value==='string' || typeof old==='string') {
			// 直接将style设置为字符串
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	// props.dangerouslySetInnerHTML
	else if (name==='dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	}
	// 绑定dom事件
	else if (name[0]=='o' && name[1]=='n') {
		// onClickCapture
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		// 给事件绑定的处理函数是组件实例的成员方法  所以当这些dom触发事件时会调用组件的方法
		if (value) {
			if (!old)
				node.addEventListener(name, eventProxy, useCapture);
		}
		else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		setProperty(node, name, value==null ? '' : value);
		if (value==null || value===false) node.removeAttribute(name);
	}
	else {
		let ns = isSvg && (name !== (name = name.replace(/^xlink\:?/, '')));
		if (value==null || value===false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
			else node.removeAttribute(name);
		}
		else if (typeof value!=='function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
			else node.setAttribute(name, value);
		}
	}
}
```

