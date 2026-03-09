const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url} —`, err.message);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: messages.join(", ") });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, error: `This ${field} is already registered.` });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid ID format." });
  }
  if (err.name === "MulterError" || err.message?.includes("Only")) {
    return res.status(400).json({ success: false, error: err.message });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
};

module.exports = errorHandler;
