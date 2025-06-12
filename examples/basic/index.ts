import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth, type OIDCEnv } from "../../src/index.js"; // Import from our local package

// Create the Hono app
const app = new Hono<OIDCEnv>();

// Configure auth middleware
app.use(auth());

// Add a simple protected route
app.get("/", async (c) => {
  const session = await c.var.auth0Client?.getSession(c);
  return c.text(`Hello ${session?.user?.name ?? "user"}!
    You are authenticated.`);
});

// Start the server
console.log("Server starting at http://localhost:3000");

serve({
  fetch: app.fetch,
  port: 3000,
});
