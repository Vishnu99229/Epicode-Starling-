import Fastify from "fastify";

// api: Starling control-plane HTTP API (Phase 1+)
const app = Fastify({ logger: true });

const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "0.0.0.0" });
app.log.info("api up");
