// server.js
const express = require("express");
const app = express();
const { auth, requiredScopes } = require("express-oauth2-jwt-bearer");
const cors = require("cors");
const axios = require("axios"); // Need axios for HTTP requests
require("dotenv").config();

// --- Environment Variable Checks ---
// Ensure all necessary environment variables are set
if (
  !process.env.ISSUER_BASE_URL ||
  !process.env.AUDIENCE ||
  !process.env.AUTH0_M2M_CLIENT_ID ||
  !process.env.AUTH0_M2M_CLIENT_SECRET ||
  !process.env.AUTH0_AUDIENCE_MANAGEMENT_API ||
  !process.env.FRONTEND_URL
) {
  throw "Make sure you have ISSUER_BASE_URL, AUDIENCE, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET, and AUTH0_AUDIENCE_MANAGEMENT_API in your .env file";
}

// --- CORS Configuration ---
const corsOptions = {
  origin: process.env.FRONTEND_URL, // URL of the React app
};
app.use(cors(corsOptions));

// --- Auth0 User Token Validation Middleware ---
// This middleware validates the user's token sent from the frontend
const checkJwt = auth({
  audience: process.env.AUDIENCE,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
});

// --- M2M Token Fetching (for Auth0 Management API) ---
let managementApiToken = null;
let tokenExpiryTime = 0; // Unix timestamp in seconds

// Function to get or refresh the M2M access token securely
async function getManagementApiToken() {
  const now = Date.now() / 1000; // Current time in seconds

  // If we have a valid token that expires in more than 60 seconds, return it
  if (managementApiToken && tokenExpiryTime > now + 60) {
    return managementApiToken;
  }

  //console.log("Fetching new Auth0 Management API token...");

  try {
    const response = await axios.post(
      `${process.env.ISSUER_BASE_URL}/oauth/token`,
      {
        grant_type: "client_credentials",
        client_id: process.env.AUTH0_M2M_CLIENT_ID,
        client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
        audience: process.env.AUTH0_AUDIENCE_MANAGEMENT_API,
        // Scopes to read clients and actions
        scope: "read:clients read:actions",
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    managementApiToken = response.data.access_token;
    tokenExpiryTime = now + response.data.expires_in; // expires_in is in seconds

    //console.log("Successfully fetched new M2M token.");
    return managementApiToken;
  } catch (error) {
    console.error(
      "Error fetching Auth0 Management API token:",
      error.response?.data || error.message
    );
    throw new Error("Backend failed to obtain Auth0 Management API token");
  }
}

// --- Custom Middleware to Check for process.env.REQUIRED_ROLE Role ---
// This middleware runs AFTER checkJwt and checks the user's roles claim
const checkRequiredRole = (req, res, next) => {
  //console.log("Checking user role...");
  // express-oauth2-jwt-bearer puts the decoded token payload on req.auth.payload
  const userPayload = req.auth?.payload; // Access the validated token payload

  if (!userPayload) {
    // This case should ideally not be hit if checkJwt is used before this middleware
    console.warn("checkRequiredRole called without validated user payload");
    return res.status(401).send({ message: "Authentication is required" });
  }

  // The namespace MUST match the one used in your Auth0 Login Action for Access Tokens
  const rolesClaimNamespace = "http://schemas.myapp.com/roles"; // <<< USE YOUR EXACT NAMESPACE

  //console.log(`User payload: ${JSON.stringify(userPayload, null, 2)}`); // Log the user payload for debugging
  const userRoles = userPayload[rolesClaimNamespace];
  //console.log(`User roles from claims: ${JSON.stringify(userRoles, null, 2)}`); // Log the user roles for debugging

  // Check if the claim exists, is an array, and includes the 'Manager' role (or whatever role defined in process.env.REQUIRED_ROLE)
  if (
    Array.isArray(userRoles) &&
    userRoles.includes(process.env.REQUIRED_ROLE)
  ) {
    //console.log(`User has ${process.env.REQUIRED_ROLE} role. Proceeding.`);
    next(); // User is authorized, proceed to the next middleware or route handler
  } else {
    const dat = new Date();
    console.warn(
      `${dat.getHours()}:${dat.getMinutes()} User does not have ${
        process.env.REQUIRED_ROLE
      } role. Access denied.`
    );
    res
      .status(403)
      .send({ message: `Requires ${process.env.REQUIRED_ROLE} role` }); // Send 403 Forbidden
  }
};
/* 
// --- Existing: Public Endpoint ---
app.get("/api/public", function (req, res) {
  res.json({
    message:
      "Hello from a public endpoint! You don't need to be authenticated to see this.",
  });
});

// --- Existing: Protected Endpoint (requires authentication) ---
app.get("/api/private", checkJwt, function (req, res) {
  res.json({
    message:
      "Hello from a private endpoint! You need to be authenticated to see this.",
  });
});

// --- Existing: Protected Endpoint (requires authentication and scope) ---
app.get(
  "/api/private-scoped",
  checkJwt,
  requiredScopes("read:messages"),
  function (req, res) {
    res.json({
      message:
        "Hello from a private endpoint! You need to be authenticated and have a scope of read:messages to see this.",
    });
  }
); */

// --- Report Endpoint (requires authentication and Manager role - or other defined in env variables) ---
app.get(
  "/api/report/applications-actions",
  checkJwt, // 1. Validate the user's token
  checkRequiredRole, // 2. Check if the authenticated user has the Manager role (or other defined in env vbles)
  async (req, res, next) => {
    try {
      //console.log("Fetching report data...");
      // 3. Get the M2M token to call the Management API
      const m2mToken = await getManagementApiToken();

      // 4. Fetch Clients (Applications) from Auth0 Management API
      const clientsResponse = await axios.get(
        `${process.env.AUTH0_AUDIENCE_MANAGEMENT_API}clients`,
        {
          headers: { Authorization: `Bearer ${m2mToken}` },
          // Optional: Add parameters like ?fields=client_id,name,description&include_fields=true
        }
      );
      const clients = clientsResponse.data;
      // console.log(
      //   `Fetched applications (clients) from Auth0 mgmt API: ${JSON.stringify(
      //     clients
      //   )}`
      //);

      // 5. Fetch Actions from Auth0 Management API
      const actionsResponse = await axios.get(
        `${process.env.AUTH0_AUDIENCE_MANAGEMENT_API}actions/actions`,
        {
          headers: { Authorization: `Bearer ${m2mToken}` },
          // Optional: Add parameters
        }
      );
      const actions = actionsResponse.data.actions; // Actions are usually in the 'actions' property
      // console.log(
      //   `Fetched actions from Auth0 mgmt API: ${JSON.stringify(actions)}`
      // );

      /*       // 6. Fetch Triggers from Auth0 Management API (commented, not necessary)
      const triggersResponse = await axios.get(
        `${process.env.AUTH0_AUDIENCE_MANAGEMENT_API}actions/triggers`,
        {
          headers: { Authorization: `Bearer ${m2mToken}` },
          params: {
            // Add query parameters
            fields: "id,version,status", // Request necessary fields
            include_fields: true, // Ensure fields parameter is applied
          },
        }
      );
      const triggers = triggersResponse.data.triggers; */

      // 7. Process data for Report (Report by Trigger)
      const actionsWithTriggers = actions.map((action) => ({
        id: action.id,
        name: action.name,
        code: action.code || "No code available", // Handle case where code might not be present
        // Extract trigger types from deployed_versions array
        // Triggers being actually used
        // triggers: Array.isArray(action.deployed_versions)
        //   ? action.deployed_versions
        //       .map((version) => version.trigger_id)
        //       .filter(Boolean)
        //   : [],
        // Triggers potentially deployed
        triggers: Array.isArray(action.supported_triggers)
          ? action.supported_triggers.map((trigger) => trigger.id)
          : [],
        //metadata: action.metadata || {}, // Optional: Include metadata if needed
        // Optionally include code snippet if you fetched the 'code' field
        // codeSnippet: action.code ? action.code.substring(0, 200) + '...' : 'No code available',
        // Add a link to the action in the dashboard (requires domain and action.id)
        // auth0DashboardLink: `https://${process.env.AUTH0_DOMAIN}/#/actions/library/${action.id}/flow`
      }));
      // console.log(
      //   `=============== Fetched actions with triggers: ${JSON.stringify(
      //     actionsWithTriggers
      //   )}`
      // );

      // 8. Send combined data back to the frontend
      const appsWithActions = clients
        .filter((c) => c.name !== "All Applications")
        .map((client) => ({
          client_id: client.client_id,
          name: client.name,
          description: client.description,
          // Add other client details you need (e.g., client_metadata)
          // metadata: client.client_metadata || {}
          app_actions: actionsWithTriggers.filter((action) =>
            action.code.includes(client.client_id)
          ), // Check if the client ID is in the action code
        }));
      // console.log(
      //   `================== Fetched applications with actions: ${JSON.stringify(
      //     appsWithActions
      //   )}`
      // );
      res.json({
        applications: appsWithActions,
      });
    } catch (error) {
      // Log the error details on the backend
      console.error(
        "Error in /api/report/applications-actions endpoint:",
        error.response?.data || error.message || error
      );
      // Pass the error to the next error handling middleware
      // Use next(error) so the error handler below can format the response
      next(error);
    }
  }
);

// --- Existing: Error Handling Middleware ---
// This middleware catches errors thrown by previous middleware or route handlers
app.use(function (err, req, res, next) {
  console.error("Caught error in middleware:", err.stack);

  // Determine appropriate status code
  let status = 500; // Default to Internal Server Error
  let message = "An unexpected error occurred";

  if (err.status) {
    status = err.status;
    message = err.message;
  } else if (
    err.message.includes(`Requires ${process.env.REQUIRED_ROLE} role`)
  ) {
    status = 403; // Forbidden
    message = `Requires ${process.env.REQUIRED_ROLE} role`;
  } else if (err.message.includes("Authentication is required")) {
    status = 401; // Unauthorized
    message = "Authentication is required";
  } else if (err.message.includes("Auth0 Management API")) {
    status = 500; // Error calling Auth0 API
    message = "Error fetching data from Auth0";
  }

  // Set headers and send JSON response
  return res
    .set(err.headers || {})
    .status(status)
    .json({ message: message });
});

// --- Existing: Server Start ---
app.listen(3010, () => {
  console.log("Backend listening on http://localhost:3010");
});
