const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
import fetch from "node-fetch";

admin.initializeApp();
const db = admin.firestore();

const app = express();

// Shopify configuration from Firebase Functions config
// (set these using: firebase functions:config:set
//  shopify.api_key="YOUR_API_KEY" shopify.api_secret="YOUR_API_SECRET")
const SHOPIFY_API_KEY = functions.config().shopify.api_key;
const SHOPIFY_API_SECRET = functions.config().shopify.api_secret;
const SHOPIFY_SCOPES = "read_products,read_orders";
const SHOPIFY_REDIRECT_URI = "https://your-domain.com/auth/shopify/callback";

// Endpoint to start Shopify OAuth flow
app.get("/auth/shopify", (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).send("Missing shop parameter.");
  }
  // Generate a state parameter (in production, use a secure random string)
  const state = "nonce";
  const installUrl =
    "https://" +
    shop +
    "/admin/oauth/authorize?client_id=" +
    SHOPIFY_API_KEY +
    "&scope=" +
    SHOPIFY_SCOPES +
    "&redirect_uri=" +
    encodeURIComponent(SHOPIFY_REDIRECT_URI) +
    "&state=" +
    state +
    "&grant_options[]=per-user";
  return res.redirect(installUrl);
});

// Endpoint to handle Shopify OAuth callback
app.get("/auth/shopify/callback", async (req, res) => {
  const {shop, code} = req.query;
  if (!shop || !code) {
    return res.status(400).send("Missing shop or code parameter.");
  }
  const accessTokenUrl = "https://" + shop + "/admin/oauth/access_token";
  try {
    const response = await fetch(accessTokenUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code: code,
      }),
    });
    const data = await response.json();
    const accessToken = data.access_token;
    await db.collection("userConnections").doc(shop).set({
      shop: shop,
      accessToken: accessToken,
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.send("Shopify account connected successfully!");
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return res.status(500).send("Error connecting Shopify account.");
  }
});

exports.api = functions.https.onRequest(app);
