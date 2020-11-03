const http = require("http");
const context = require("./context");
const request = require("./request");
const response = require("./response");

module.exports = class Coa {
  constructor() {
    this.middleware = [];
    this.context = context;
    this.request = request;
    this.response = response;
  }

  use(fn) {
    if (typeof fn !== "function")
      throw new TypeError("middleware must be a function!");
    this.middleware.push(fn);
    return this;
  }

  listen(...args) {
    const server = http.createServer(this.callback());
    server.listen(...args);
    console.log(`App listen to ${args[1] || "127.0.0.1"}:${args[0]}`);
  }

  callback() {
    const handleRequest = (req, res) => {
      // 创建上下文
      const ctx = this.createContext(req, res);
      return this.compose(this.middleware)(ctx)
        .then(() => respond(ctx))
        .catch(console.error);
    };
    return handleRequest;
  }

  // 创建上下文
  createContext(req, res) {
    const ctx = Object.create(this.context);
    // 扩展的属性
    const request = (ctx.request = Object.create(this.request));
    const response = (ctx.response = Object.create(this.response));

    ctx.app = request.app = response.app = this;
    // 原生属性
    ctx.req = request.req = response.req = req;
    ctx.res = request.res = response.res = res;

    request.ctx = response.ctx = ctx;
    request.response = response;
    response.request = request;

    return ctx;
  }

  // 中间件处理逻辑实现
  compose1(middlewares) {
    return middlewares.reduce(
      (callbackResult, CurrentCallback) => {
        return (ctx, next = () => {}) => {
          return callbackResult(ctx, () => CurrentCallback(ctx, next));
        };
      },
      async (Object, next = () => {}) => {
        next();
      }
    );
  }
  conposeRedux1(middlewares) {
    return middlewares.reduce((next, b) => ctx => next(b(ctx)));
  }
  // 中间件处理逻辑实现
  conposeRedux(middlewares) {
    return ctx => middlewares.reduceRight((next, b) => b(next), ctx);
  }
  compose(middlewares) {
    return ctx =>
      middlewares.reduceRight(
        (next, middleware) => async () => await middleware(ctx, next),
        () => {}
      )();
  }
  // 中间件处理逻辑实现
  compose2(middlewares) {
    return ctx => {
      const dispatch = async i => {
        const fn = middlewares[i];
        if (i === middlewares.length) return;
        return await fn(ctx, () => dispatch(i + 1));
      };
      return dispatch(0);
    };
  }
};

// 处理 body 不同类型输出
function respond(ctx) {
  let res = ctx.res;
  let body = ctx.body;
  if (typeof body === "string") {
    return res.end(body);
  }
  if (typeof body === "object") {
    return res.end(JSON.stringify(body));
  }
}
