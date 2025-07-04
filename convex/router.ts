import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

const http = httpRouter();

function extractSessionId(url: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  return pathParts[4]; // Assuming format /api/v1/sessions/{sessionId}/...
}

// Advanced API endpoints for external integrations
http.route({
  path: "/api/v1/sessions/{sessionId}/locations",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const sessionId = extractSessionId(req.url);
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("read:locations")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const locations = await ctx.runQuery(internal.api.getSessionLocationsWithAuth, { 
        apiKey,
        sessionId: sessionId as any 
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: locations,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/v1/sessions/{sessionId}/alerts",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[4];
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("read:alerts")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const alerts = await ctx.runQuery(internal.api.getSessionAlertsWithAuth, { 
        apiKey,
        sessionId: sessionId as any 
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: alerts,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/v1/sessions/{sessionId}/alerts",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[4];
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("write:alerts")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const body = await req.json();
      const { type, message, userId } = body;

      if (!type || !userId) {
        return new Response("Missing required fields: type, userId", { status: 400 });
      }

      await ctx.runMutation(internal.api.sendExternalAlert, {
        apiKey,
        sessionId: sessionId as any,
        type,
        message,
        userId,
      });

      // Log webhook event
      await ctx.runMutation(api.api.logWebhookEvent, {
        sessionId: sessionId as any,
        apiKeyId: keyRecord._id,
        payload: body,
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: "Alert sent successfully",
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/v1/sessions/{sessionId}/geofences",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[4];
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("read:geofences")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const geofences = await ctx.runQuery(internal.api.getSessionGeofencesWithAuth, { 
        apiKey,
        sessionId: sessionId as any 
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: geofences,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/v1/sessions/{sessionId}/geofences",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[4];
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("write:geofences")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const body = await req.json();
      const { name, type, shape, center, radius, coordinates, alertOnEntry, alertOnExit, description } = body;

      if (!name || !type || !shape) {
        return new Response("Missing required fields: name, type, shape", { status: 400 });
      }

      const geofenceId = await ctx.runMutation(api.geofences.createGeofence, {
        sessionId: sessionId as any,
        name,
        type,
        shape,
        center,
        radius,
        coordinates,
        alertOnEntry: alertOnEntry ?? true,
        alertOnExit: alertOnExit ?? true,
        description,
      });

      // Log webhook event
      await ctx.runMutation(api.api.logWebhookEvent, {
        sessionId: sessionId as any,
        apiKeyId: keyRecord._id,
        payload: body,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: { geofenceId },
        message: "Geofence created successfully",
        timestamp: new Date().toISOString(),
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/api/v1/sessions/{sessionId}/analytics",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[4];
    const apiKey = req.headers.get("x-api-key");
    const timeRange = url.searchParams.get("timeRange") || "24h";
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("read:analytics")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const analytics = await ctx.runQuery(api.geofences.getGeofenceAnalytics, { 
        sessionId: sessionId as any,
        timeRange: timeRange as any,
      });
      
      return new Response(JSON.stringify({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Webhook endpoint for real-time updates
http.route({
  path: "/api/v1/webhook/{sessionId}",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[3];
    const apiKey = req.headers.get("x-api-key");
    
    if (!apiKey) {
      return new Response("API key required", { status: 401 });
    }

    // Verify API key
    const keyRecord = await ctx.runQuery(api.api.verifyApiKey, { key: apiKey });
    if (!keyRecord || !keyRecord.permissions.includes("webhook")) {
      return new Response("Invalid API key or insufficient permissions", { status: 403 });
    }

    try {
      const body = await req.json();
      
      // Log webhook event
      await ctx.runMutation(api.api.logWebhookEvent, {
        sessionId: sessionId as any,
        apiKeyId: keyRecord._id,
        payload: body,
      });

      // Process webhook based on event type
      const { event, data } = body;
      
      switch (event) {
        case "location_update":
          if (data.userId && data.location) {
            await ctx.runMutation(api.locations.updateLocation, {
              sessionId: sessionId as any,
              location: data.location,
            });
          }
          break;
        case "alert_trigger":
          if (data.type && data.userId) {
            await ctx.runMutation(api.alerts.sendAlert, {
              sessionId: sessionId as any,
              type: data.type,
              message: data.message,
              createdBy: data.userId,
            });
          }
          break;
        default:
          return new Response("Unknown event type", { status: 400 });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
