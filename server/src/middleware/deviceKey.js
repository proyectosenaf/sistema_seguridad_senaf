export function deviceKey(required = true) {
  return (req,res,next) => {
    const key = req.headers["x-device-key"];
    const ok = !!key && key === process.env.DEVICE_API_KEY;
    if (required && !ok) return res.status(401).json({ error: "invalid device key" });
    next();
  };
}
