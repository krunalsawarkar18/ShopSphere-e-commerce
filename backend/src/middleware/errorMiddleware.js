function notFound(req, res, next) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found." });
  }

  return next();
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.statusCode || 500).json({
    message: err.message || "Something went wrong."
  });
}

module.exports = { notFound, errorHandler };
