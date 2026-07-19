require("dotenv").config();
const path = require("path");
const express = require("express");
const { ensureSchema, insertEnquiry } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "client")));

app.post("/api/enquiries", async (req, res) => {
  const { fullName, email, phone, message } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ status: "error", message: "Full name and email are required." });
  }

  try {
    const enquiry = await insertEnquiry({ fullName, email, phone, message });
    console.log("New enquiry saved:", enquiry.id);
    res.status(201).json({ status: "ok" });
  } catch (err) {
    console.error("Failed to save enquiry:", err);
    res.status(500).json({ status: "error", message: "Failed to save enquiry." });
  }
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
