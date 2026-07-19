require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { ensureSchema, query } = require("./db");

const brandsRouter = require("./crm/routes/brands");
const contactsRouter = require("./crm/routes/contacts");
const campaignsRouter = require("./crm/routes/campaigns");
const templatesRouter = require("./crm/routes/templates");
const activityRouter = require("./crm/routes/activity");
const settingsRouter = require("./crm/routes/settings");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

const ADMIN_DIST = path.join(__dirname, "..", "admin-frontend", "dist");
const CLIENT_DIR = path.join(__dirname, "..", "client");

app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
if (!isProd) {
  app.use(cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }));
}
app.use(morgan(isProd ? "combined" : "dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// GC Luxury public marketing site
app.use(express.static(CLIENT_DIR));

// CRM admin (built React app), served under /admin
if (fs.existsSync(ADMIN_DIST)) {
  app.use("/admin", express.static(ADMIN_DIST));
}

// CRM API
app.use("/api/brands", brandsRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/activity", activityRouter);
app.use("/api/settings", settingsRouter);

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", db: "connected", time: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected", error: err.message });
  }
});

// GC Luxury enquiry form -> lands as a CRM contact under the "GC Luxury" brand
app.post("/api/enquiries", async (req, res) => {
  const { fullName, email, phone, propertyType, priceRange, locations, translator, message } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ status: "error", message: "Full name and email are required." });
  }

  try {
    const brandResult = await query("SELECT id FROM brands WHERE name = $1", ["GC Luxury"]);
    const brandId = brandResult.rows[0]?.id || null;

    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.join(" ");

    const customFields = {
      property_type: propertyType || null,
      price_range: priceRange || null,
      locations: locations || null,
      translator: translator || null,
    };

    const contactResult = await query(
      `INSERT INTO contacts (brand_id, first_name, last_name, email, phone, source, pipeline_stage, custom_fields)
       VALUES ($1, $2, $3, $4, $5, 'Website', 'New', $6)
       RETURNING id`,
      [brandId, firstName || fullName, lastName, email, phone || null, JSON.stringify(customFields)]
    );
    const contactId = contactResult.rows[0].id;

    const noteLines = [];
    if (propertyType) noteLines.push(`Property type: ${propertyType}`);
    if (priceRange) noteLines.push(`Budget: ${priceRange}`);
    if (locations) noteLines.push(`Preferred location(s): ${locations}`);
    if (translator) noteLines.push(`Translator requested: ${translator}`);
    if (message) noteLines.push(`Message: ${message}`);

    if (noteLines.length) {
      await query(
        "INSERT INTO contact_notes (contact_id, note, created_by) VALUES ($1, $2, $3)",
        [contactId, noteLines.join("\n"), "Website Enquiry"]
      );
    }

    await query(
      `INSERT INTO activity_log (contact_id, brand_id, type, description)
       VALUES ($1, $2, 'contact_created', $3)`,
      [contactId, brandId, `New enquiry from GC Luxury website: ${fullName}`]
    );

    console.log("New enquiry saved as contact:", contactId);
    res.status(201).json({ status: "ok" });
  } catch (err) {
    console.error("Failed to save enquiry:", err);
    res.status(500).json({ status: "error", message: "Failed to save enquiry." });
  }
});

// SPA fallback for the CRM admin app
if (fs.existsSync(ADMIN_DIST)) {
  app.get("/admin/*splat", (req, res) => {
    res.sendFile(path.join(ADMIN_DIST, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`GC Luxury server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  });
