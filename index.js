// server/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Character = require("./models/Character");

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Connexion MongoDB via Mongoose
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ MONGODB_URI manquant dans l'environnement (.env ?)");
  process.exit(1);
}

async function start() {
  try {
    await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      dbName: "aria_characters",
    });
    console.log("✅ Connecté à MongoDB");

    app.listen(PORT, () => {
      console.log(`🚀 Backend Aria lancé sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erreur de connexion MongoDB :", err);
    process.exit(1);
  }
}

// Test simple
app.get("/", (req, res) => {
  res.send("Backend Aria + MongoDB en ligne ✨");
});

// POST /characters : enregistre un perso
app.post("/characters", async (req, res) => {
  try {
    const payload = req.body;

    console.log("📥 Nouveau personnage reçu :", payload);

    const character = await Character.create(payload);

    res.status(201).json({
      status: "ok",
      message: "Personnage enregistré en base",
      id: character._id,
    });
  } catch (error) {
    console.error("❌ Erreur en sauvegardant le personnage :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en sauvegardant le personnage",
    });
  }
});

// GET /characters : liste de tous les persos
app.get("/characters", async (req, res) => {
  try {
    const characters = await Character.find().sort({ createdAt: -1 });
    res.json(characters);
  } catch (error) {
    console.error("❌ Erreur en récupérant les personnages :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en récupérant les personnages",
    });
  }
});

start();
