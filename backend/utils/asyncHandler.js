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
 */
const asyncHandler = (handler) => {
  if (typeof handler !== "function") {
    throw new TypeError(
      "asyncHandler requires a controller function."
    );
  }

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