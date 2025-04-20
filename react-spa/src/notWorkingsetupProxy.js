const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api", // The path the frontend requests (starts with /api)
    createProxyMiddleware({
      target: "http://localhost:3010", // The address and port of your backend server
      changeOrigin: true, // Often needed for virtual hosted sites
    })
  );
};
