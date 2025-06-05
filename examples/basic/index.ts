import { serve } from "@hono/node-server";
import { Context, Hono } from "hono";
import { auth, OIDCEnv, OIDCVariables } from "../../src"; // Import from our local package

// Create the Hono app
const app = new Hono<{
  Variables: OIDCVariables<{ test: number }>;
}>();

// Configure auth middleware
const authMiddleware = auth({
  domain: process.env.AUTH0_DOMAIN || "https://YOUR_DOMAIN",
  clientID: process.env.AUTH0_CLIENT_ID || "YOUR_CLIENT_ID",
  clientSecret: process.env.AUTH0_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
  baseURL: process.env.BASE_URL || "http://localhost:3000",
  session: {
    encryptionKey: process.env.OIDC_AUTH_SECRET,
  },
});

app.use(authMiddleware);

// Add a simple protected route
app.get("/", (c: Context<OIDCEnv>) => {
  // Access the authenticated user from context
  const user = c.var.oidc?.claims;
  return c.text(`Hello ${user?.name || "User"}!
    You are authenticated.`);
});

app.get("/session-test", async (c) => {
  const current = c.get("session")?.get("test") ?? 0;
  c.get("session")?.set("test", current + 1);
  return c.text(`Session test: ${current + 1}`);
});

// Add an unprotected route
app.get("/public", (c) => {
  return c.text("Public route - no authentication required");
});

// Start the server
console.log("Server starting at http://localhost:3000");

serve({
  fetch: app.fetch,
  port: 3000,
});
