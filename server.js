import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const sessions = new Map();

const RELAY_SECRET = process.env.RELAY_SECRET || "change-this-secret";

app.post("/register", (req, res) => {
  const { sessionId, tunnelUrl, secret } = req.body;

  if (secret !== RELAY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  sessions.set(sessionId, tunnelUrl);
  console.log("Registered session:", sessionId, tunnelUrl);

  res.json({ ok: true });
});

app.use("/minecraft/:sessionId/*", async (req, res) => {
  const { sessionId } = req.params;

  const tunnelUrlRaw = sessions.get(sessionId);
  if (!tunnelUrlRaw) return res.status(404).json({ error: "Session not found" });

  let base;
  try {
    base = new URL(tunnelUrlRaw).origin; // asegura que sea solo https://host
  } catch {
    return res.status(400).json({ error: "Bad tunnelUrl stored" });
  }

  // Parte capturada por el wildcard (*) en Express
  const restPath = req.params[0] ? `/${req.params[0]}` : "/";

  // Conserva querystring si existe
  const qsIndex = req.originalUrl.indexOf("?");
  const qs = qsIndex >= 0 ? req.originalUrl.substring(qsIndex) : "";

  const target = new URL(restPath + qs, base).toString();
  console.log("[relay] ->", target);

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "GET" ? undefined : JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.get("/", (req, res) => {
  res.send("MC Relay Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Relay listening on port", PORT));
