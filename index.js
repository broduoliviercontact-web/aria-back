// server/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const Character = require("./models/Character");
const User = require("./models/User");

const app = express();

// -------------------- CONFIG ENV --------------------
const PORT = process.env.PORT || 4000;

// On accepte MONGO_URI ou MONGODB_URI
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Vérification des variables d'environnement importantes
if (!MONGO_URI) {
  console.error("❌ ERREUR : MONGO_URI ou MONGODB_URI manquant dans les variables d'environnement !");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("❌ ERREUR : JWT_SECRET manquant dans les variables d'environnement !");
  process.exit(1);
}

// -------------------- MIDDLEWARES GLOBAUX --------------------

// Sécurité headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS : autoriser ton front local + ton front Netlify
const allowedOrigins = [
  "http://localhost:5173",
  "https://aria-sheet.netlify.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // autoriser aussi les requêtes sans origin (curl, Postman, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("⛔ Origin non autorisé par CORS :", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Limiter la taille du JSON
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));
app.use(cookieParser());

// -------------------- RATE LIMIT (AUTH) --------------------

// Limite les tentatives de /auth/* pour éviter le brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // max 50 requêtes / 15 min / IP
  message: {
    status: "error",
    message: "Trop de requêtes, réessaie plus tard.",
  },
});

app.use("/auth", authLimiter);

// -------------------- HELPER TOKEN --------------------
function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// -------------------- MIDDLEWARE AUTH --------------------
async function authRequired(req, res, next) {
  try {
    const token =
      req.cookies.token ||
      (req.headers.authorization &&
        req.headers.authorization.split(" ")[1]);

    if (!token) {
      return res.status(401).json({ message: "Authentification requise" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    console.error("❌ Erreur auth :", err);
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
}

// -------------------- ROUTES AUTH --------------------

// Inscription
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation très simple
    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe sont obligatoires" });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ message: "Email invalide" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Mot de passe trop court (min 8 caractères)" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      passwordHash,
      displayName: displayName || "",
    });

    const token = createToken(user);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "none", // pour cookie cross-site
        secure: true, // ton back est en HTTPS (code.run / Northflank)
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        id: user._id,
        email: user.email,
        displayName: user.displayName,
      });
  } catch (err) {
    console.error("❌ Erreur /auth/register :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Connexion
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe sont obligatoires" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const token = createToken(user);

    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        id: user._id,
        email: user.email,
        displayName: user.displayName,
      });
  } catch (err) {
    console.error("❌ Erreur /auth/login :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Déconnexion
app.post("/auth/logout", (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    })
    .json({ message: "Déconnecté" });
});

// Infos du user courant
app.get("/auth/me", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("email displayName");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ Erreur /auth/me :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// -------------------- ROUTES CHARACTERS --------------------

// Créer / sauvegarder un personnage
app.post("/characters", authRequired, async (req, res) => {
  try {
    const payload = req.body;

    const character = await Character.create({
      ...payload,
      user: req.userId, // lien vers le user connecté
    });

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

// Récupérer tous les personnages du user
app.get("/characters", authRequired, async (req, res) => {
  try {
    const characters = await Character.find({ user: req.userId }).sort({
      createdAt: -1,
    });
    res.json(characters);
  } catch (error) {
    console.error("❌ Erreur en récupérant les personnages :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en récupérant les personnages",
    });
  }
});

// Récupérer un personnage précis
app.get("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const character = await Character.findOne({
      _id: id,
      user: req.userId,
    });

    if (!character) {
      return res.status(404).json({ message: "Personnage introuvable" });
    }

    res.json(character);
  } catch (error) {
    console.error("❌ Erreur en récupérant le personnage :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en récupérant le personnage",
    });
  }
});

// Mettre à jour un personnage
app.put("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const updated = await Character.findOneAndUpdate(
      { _id: id, user: req.userId },
      {
        ...payload,
        user: req.userId, // on force le propriétaire
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({ message: "Personnage introuvable" });
    }

    res.json({
      status: "ok",
      message: "Personnage mis à jour",
      character: updated,
    });
  } catch (error) {
    console.error("❌ Erreur en mettant à jour le personnage :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en mettant à jour le personnage",
    });
  }
});

// Supprimer un personnage
app.delete("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Character.findOneAndDelete({
      _id: id,
      user: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Personnage introuvable" });
    }

    res.json({
      status: "ok",
      message: "Personnage supprimé",
    });
  } catch (error) {
    console.error("❌ Erreur en supprimant le personnage :", error);
    res.status(500).json({
      status: "error",
      message: "Erreur serveur en supprimant le personnage",
    });
  }
});

// -------------------- HEALTHCHECK --------------------
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Aria API" });
});

// -------------------- START SERVER --------------------
async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connecté à MongoDB");

    app.listen(PORT, () => {
      console.log(`✅ Server lancé sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erreur de connexion MongoDB :", err);
    process.exit(1);
  }
}

start();
