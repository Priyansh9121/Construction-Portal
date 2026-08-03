/*
|--------------------------------------------------------------------------
| Async error forwarding
|--------------------------------------------------------------------------
|
| Express 4 does not understand promises. If an `async` handler rejects,
| Express never sees the error: `next` is not called, the error handler does
| not run, and the request hangs until the client gives up. Every route in
| this codebase is async, so every route needs the rejection routed back
| into Express by hand.
|
| This wrapper is that routing. It is the single most widely used helper in
| the backend — 25 route and middleware files import it — which is why it is
| kept deliberately tiny and dependency-free.
|
| The alternative would be a try/catch in all several hundred controllers.
| One wrapper at the route definition means a controller can throw freely
| and trust that errorHandler.js will turn it into a JSON response.
|
| Depends on:
|   nothing
|
| Exports:
|   asyncHandler (default export — the module exports the function itself,
|   not an object, so callers write `require("../utils/asyncHandler")`)
|
| Used by:
|   every *.routes.js file, and upload.middleware.js
|
| Downstream:
|   errors forwarded from here land in middleware/errorHandler.js, which
|   decides the status code and response shape.
|
*/

/**
 * Wraps an asynchronous Express controller or middleware.
 *
 * Any rejected promise or thrown error is passed to the
 * global Express error handler through next(error).
 *
 * Usage:
 *
 * router.get(
 *   "/",
 *   asyncHandler(controller.getRecords)
 * );
 *
 * Purpose:
 * Bridges promise rejection to Express's callback-style error channel, so
 * an async controller never has to catch on its own behalf.
 *
 * Parameters:
 * handler - an Express handler (req, res, next). May be async or sync.
 *
 * Returns:
 * A new handler with the same signature, safe to pass to router.get and
 * friends.
 *
 * Side effects:
 * None of its own; it only calls through to the wrapped handler.
 *
 * Notes:
 * The typeof guard fails loudly at startup rather than at request time.
 * `asyncHandler(controller.getThing)` where `getThing` is misspelled would
 * otherwise wrap `undefined` and only blow up when someone hit the route in
 * production — this way the process refuses to boot.
 */
const asyncHandler = (handler) => {
  if (typeof handler !== "function") {
    throw new TypeError(
      "asyncHandler requires a controller function."
    );
  }

  /*
   * Named rather than anonymous so it shows up as `wrappedAsyncHandler` in
   * stack traces instead of an unhelpful blank frame.
   *
   * Promise.resolve() normalises the two cases: an async handler returns a
   * promise, a synchronous one returns undefined. Wrapping means .catch is
   * always available without testing which kind was passed.
   *
   * A synchronous `throw` inside the handler is *not* caught here — it
   * propagates out of the call before Promise.resolve sees it, and Express
   * catches that itself. Only rejections need this treatment.
   */
  return function wrappedAsyncHandler(
    req,
    res,
    next
  ) {
    return Promise.resolve(
      handler(req, res, next)
    ).catch(next);
  };
};

module.exports = asyncHandler;