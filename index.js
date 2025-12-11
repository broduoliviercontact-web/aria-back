// server/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Character = require("./models/Character");
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 4000;
// Accept both MONGO_URI and MONGODB_URI env names
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/aria";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// -------------------- MIDDLEWARES --------------------
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://aria-sheet.netlify.app", // ← mets EXACTEMENT ton domaine
    ],
    credentials: true,
  })
);


app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));
app.use(cookieParser());

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

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe sont obligatoires" });
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
    sameSite: "none",   // <<< IMPORTANT pour cross-site
    secure: true,       // le domaine Northflank est en HTTPS
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

// -------------------- ROUTES CHARACTERS EXISTANTES --------------------

// POST /characters : créer / sauvegarder un personnage
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

// GET /characters : liste des persos du user
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

// -------------------- ROUTES CHARACTERS AVEC :id --------------------

// GET /characters/:id : récupérer un perso précis du user
app.get("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("GET /characters/:id =>", id, "user", req.userId);

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

// PUT /characters/:id : mettre à jour un perso
app.put("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    console.log("PUT /characters/:id =>", id, "user", req.userId);
    // optionnel : console.log("Payload reçu :", payload);

    const updated = await Character.findOneAndUpdate(
      { _id: id, user: req.userId },
      {
        ...payload,
        user: req.userId, // on force, pour empêcher le changement de propriétaire
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

// DELETE /characters/:id : supprimer un perso
app.delete("/characters/:id", authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    console.log("DELETE /characters/:id =>", id, "user", req.userId);

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


// Connexion
// Connexion
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Identifiants invalides" });
    }

    const token = createToken(user);

    // 👉 IMPORTANT : cookie cross-site
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "none",   // pour pouvoir l'envoyer depuis localhost:5173
        secure: true,       // code.run est en HTTPS
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

app.get("/", (req, res) => {      
  res.send("Hello World!");



  

  
});

// TODO: plus tard tu peux ajouter GET /characters/:id, PUT, DELETE, etc.
// en vérifiant bien que character.user.toString() === req.userId

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
