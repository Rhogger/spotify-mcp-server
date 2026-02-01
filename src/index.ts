import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { albumTools } from "./albums.js";
import { playTools } from "./play.js";
import { playlistTools } from "./playlists.js";
import { readTools } from "./read.js";
import { trackTools } from "./tracks.js";
import z from "zod";

const allTools = [
  ...readTools,
  ...playTools,
  ...playlistTools,
  ...albumTools,
  ...trackTools
];

function createMcpServer() {
  const server = new McpServer({
    name: "spotify-controller",
    version: "1.0.0",
  });

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

  return server;
}

const app = express();

const transports = new Map<string, SSEServerTransport>();
const servers = new Map<string, McpServer>();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();
  const sessionId = transport.sessionId;

  console.log(`🔌 Nova conexão SSE iniciada. SessionID: ${sessionId}`);
  transports.set(sessionId, transport);
  servers.set(sessionId, server);

  try {
    await server.connect(transport);

    await new Promise<void>((resolve) => {
      const cleanup = () => {
        resolve();
      };

      req.on("close", cleanup);
      req.on("error", (err) => {
        const errorCode = (err as any).code;
        if (errorCode === "ECONNRESET" || err.message.includes("aborted")) {
          cleanup();
          return;
        }
        console.error(`⚠️ Erro na requisição (SessionID: ${sessionId}):`, err);
        cleanup();
      });
      res.on("error", (err) => {
        console.error(`⚠️ Erro na resposta (SessionID: ${sessionId}):`, err);
        cleanup();
      });
    });
  } catch (error) {
    console.error(`❌ Erro conexao MCP (SessionID: ${sessionId}):`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to connect" });
    }
  } finally {
    console.log(`❌ Fechando sessão SSE para SessionID: ${sessionId}`);
    
    try {
      await server.close();
    } catch (err) {
      console.error(`Erro ao fechar servidor MCP (SessionID: ${sessionId}):`, err);
    }

    transports.delete(sessionId);
    servers.delete(sessionId);
    
    if (!res.writableEnded) {
       res.end();
    }
  }
});

app.post("/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const method = req.body?.method || req.body?.params?.method || "unknown";
  console.log(`📨 Recebido POST /messages (SessionID: ${sessionId}) -> Método: ${method}`);
  
  const transport = transports.get(sessionId);

  if (!transport) {
    console.log(`⚠️ SessionID não encontrado: ${sessionId}`);
    res.status(404).send("Session not found");
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
