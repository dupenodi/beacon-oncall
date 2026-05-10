import "./env.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const app = createApp();
/** Render/Fly/etc. set `PORT`; local dev often uses `API_PORT` (see `.env.example`). */
const port = Number(process.env.PORT ?? process.env.API_PORT ?? "3001");

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`beacon api listening on http://localhost:${info.port}`);
});
