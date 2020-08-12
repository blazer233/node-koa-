// Application.js
/*
将中间件函数存储到私有属性,当开始监听的时候,执行方法
requestListener 请求处理函数，自动添加到 request 事件，函数传递两个参数：req res 
将引用的模块挂载到构造函数koa下通过this来调用
ctx可以拿到context的属性但不能修改context,ctx.req是原生的方法,ctx.request是koa实现的
koa的ctx功能就是通过代理实现原生的效果(Object.defineProperty)

洋葱模型:
	next()函数是指下一个use的函数
*/
const http = require('http');

// 对象属性的 get 和 set 方法
let request = {
	get url() {
		return this.req.url;
	}
};
let response = {
	get body() {
		return this._body;
	},
	set body(val) {
		this._body = val;
	}
};
let context = {
	get url() { 
		return this.request.url;
	},
	get body() {
		return this.response.body;
	},
	set body(val) {
		this.response.body = val;
	}
};

class Application {
	constructor() {
		// context 对象
		this.context = context;
		// request 对象
		this.request = request;
		// response 对象
		this.response = response;
		// 中间件
		this.middleware = [];
	}
	async handleRequest(req, res) {
		res.statusCode = 404
		// 封装 ctx 对象
		let ctx = this.createCtx(req, res)
		// 中间件执行机制
		let middlewaresFn = this.compose(this.middleware);
		// 依次执行中间件
		await middlewaresFn(ctx);
		ctx.res.end(ctx.body);
	}
	/*封装 HTTP 模块*/
	listen(...args) {
		http.createServer(this.handleRequest.bind(this)).listen(...args)
	}
	/*封装 ctx 对象*/
	createCtx(req, res) {
		let ctx = Object.create(this.context);
		ctx.request = Object.create(this.request);
		ctx.response = Object.create(this.response);
		// 将 req 绑定到 ctx.req 上
		ctx.req = ctx.request.req = req;
		// 将 res 绑定到 ctx.res 上
		ctx.res = ctx.response.res = res;
		return ctx;
	}
	/*收集中间件*/
	use(callback) {
		this.middleware.push(callback);
	}
	/*中间件执行机制*/
	compose(middleware) {
		// 传入的middleware必须是一个数组
		if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
		// 传入的middleware的每一个元素都必须是函数
		for (const fn of middleware) {
			if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
		}
		return function (context) {
			// 维护一个 index 的闭包
			let index = -1;
			// 从第一个中间件开始依次执行
			return dispatch(0);

			function dispatch(i) {
				// 一个中间件存在多次 next 调用
				if (i <= index) return Promise.reject(new Error('next() called multiple times'));
				// 存下当前的索引
				index = i;
				let fn = middleware[i]
				// 以下两行是处理最后一个中间件还有 next 的情况
				if (i === middleware.length) fn = next; //数组中函数执行完成
				try {
					// 中间件 fn 的参数 context 为封装的 ctx 对象, 参数 next 为下一个中间件【函数】
					return Promise.resolve(fn(context, function next() {
						return dispatch(i + 1);
					}))
				} catch (err) {
					return Promise.reject(err);
				}
			}
		}
	}
}

// 测试
const app = new Application();

function delay() {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, 2000);
	});
}
app.use(async (ctx, next) => {
	console.log(1)
	await next();
	console.log(2)
});
app.use(async (ctx, next) => {
	console.log(3)
	await delay();
	await next();
	console.log(4)
});
app.use(async (ctx, next) => {
	console.log(5)
});
app.listen(3000, () => {
	console.log('server running on port 3000');
});
////同步测试
// let app = {}
// app.routers = []
// app.use = function (callback) {
// 	app.routers.push(callback)
// }
// app.use(async (ctx, next) => {
// 	console.log(1)
// 	await next()
// 	console.log(2)
// })
// app.use(async (ctx, next) => {
// 	console.log(3)
// 	await next()
// 	console.log(4)
// })
// app.use(async (ctx, next) => {
// 	console.log(5)
// 	await next()
// 	console.log(6)
// })

// function dispatch(index) {
// 	//取出第一个中间件执行,将索引递增,调用next,就是将下一个中间件继续执行
// 	if (index == app.routers.length) return
// 	let index_ = app.routers[index]
// 	index_({}, () => dispatch(index + 1))
// }
// dispatch(0)
