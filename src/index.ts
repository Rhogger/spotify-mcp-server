import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { albumTools } from "./albums.js";
import { playTools } from "./play.js";
import { readTools } from "./read.js";
import { trackTools } from "./tracks.js";
import z from "zod";

const server = new McpServer({
  name: "spotify-controller",
  version: "1.0.0",
});

const allTools = [
  ...readTools,
  ...playTools,
  ...albumTools,
  ...trackTools
];

allTools.forEach((tool) => {
  let schemaShape;

  if (tool.schema instanceof z.ZodObject) {
    schemaShape = tool.schema.shape;
  } else {
    schemaShape = tool.schema;
  }

  server.tool(
    tool.name,
    tool.description,
    schemaShape,
    tool.handler
  );
});

const app = express();

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  console.log("🔌 Nova conexão SSE iniciada");

  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);

  req.on("close", () => {
    console.log("❌ Conexão SSE fechada");
    transport = null;
  });
});

app.post("/messages", express.json(), async (req, res) => {
  if (!transport) {
    res.sendStatus(404);
    return;
  }

  await transport.handlePostMessage(req, res, req.body);

  if (!res.headersSent) {
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `🚀 Spotify MCP Server rodando via HTTP em http://0.0.0.0:${PORT}/sse`,
  );
});
