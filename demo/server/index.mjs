import Server from "../../server/dist/index.esm.js";

(async () => {
  const server = new Server(["demo"]);
  await server.start(3000, {
    cors: {
      origin: true,
    },
  });
  console.log("Server started.");
})();
