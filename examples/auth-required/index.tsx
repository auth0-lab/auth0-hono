/** @jsx jsx */

import { serve } from "@hono/node-server";
import { Context, Hono } from "hono";
import { jsxRenderer } from 'hono/jsx-renderer';
import { OIDCEnv, attemptSilentLogin, auth, requiresAuth } from "../../src"; // Import from our local package

// Create the Hono app
const app = new Hono();

// Configure auth middleware
app.use(
  auth({
    domain: process.env.AUTH0_DOMAIN || "https://YOUR_DOMAIN",
    clientID: process.env.AUTH0_CLIENT_ID || "YOUR_CLIENT_ID",
    clientSecret: process.env.AUTH0_CLIENT_SECRET || "YOUR_CLIENT_SECRET",
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    session: {
      encryptionKey: process.env.OIDC_AUTH_SECRET,
    },
    authRequired: false,
    idpLogout: true,
  }),
);

app.get(
  '/*',
  jsxRenderer(({ children }) => {
    return (
      <html>
        <body>
          <div>{children}</div>
          <div>
            <h2>Available routes</h2>
            <ul>
              <li><a href="/">/</a></li>
              <li><a href="/protected">/protected</a></li>
              <li><a href="/login">/login</a></li>
              <li><a href="/logout">/logout</a></li>
            </ul>
          </div>
        </body>
      </html>
    )
  })
);

// Add a simple protected route
app.get("/", (c: Context<OIDCEnv>) => {
  if (!c.var.oidc?.isAuthenticated) {
    return c.render(<p>
      You are currently not authenticated. Click <a href="/login">here</a> to login.
      <br />
    </p>)
  }
  return c.render(
    <p>
      Welcome {c.var.oidc?.claims?.name ?? c.var.oidc?.claims?.email}!
      You are authenticated.
      Click <a href="/logout">here</a> to logout.
    </p>
  );
});

app.get('/protected', attemptSilentLogin(), requiresAuth(), (c) => {
  return c.render(
    <p>
      This is a protected route.
      If you can see this text you are authenticated.
    </p>
  );
});

app.get('/protected-silent',
  attemptSilentLogin(),
  requiresAuth(),
  (c) => {
  return c.render(
    <p>
      This is a protected route.
      If you can see this text you are authenticated.
    </p>
  );
});


// Start the server
console.log("Server starting at http://localhost:3000");

serve({
  fetch: app.fetch,
  port: 3000,
});
