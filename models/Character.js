// server/models/Character.js
const mongoose = require("mongoose");

const StatSchema = new mongoose.Schema(
  {
    id: String,
    label: String,
    value: Number,
    min: Number,
    max: Number,
  },
  { _id: false }
);

const SpecialCompetenceSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
  },
  { _id: false }
);

const CharacterSchema = new mongoose.Schema(
  {
    // 🔐 lien avec l'utilisateur propriétaire du perso
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ----------------- MÉTA / IDENTITÉ -----------------
    meta: {
      status: { type: String, default: "draft" },
    },
    player: { type: String, default: "" },
    name: { type: String, required: true },
    profession: { type: String, default: "" },
    age: { type: Number, default: null },

    // ----------------- STATS & MODES -----------------
    stats: [StatSchema],
    diceRolls: { type: Object, default: {} },

    statMode: { type: String, default: "3d6" },
    statPointsPool: { type: Number, default: 0 },
    skillMode: { type: String, default: "ready" },
    isCreationDone: { type: Boolean, default: false },

    // ----------------- COMPÉTENCES -----------------
    xp: { type: Number, default: 0 },
    competences: { type: Array, default: [] },
    specialCompetences: [SpecialCompetenceSchema],

    // ----------------- INVENTAIRE -----------------
    // Tu pourras y stocker les mêmes objets que dans ton front
    inventory: {
      type: Array,
      default: [],
    },

    // ----------------- ALCHIMIE -----------------
    // Tu peux y mettre par ex. { enabled: true, potions: [...] }
    alchemy: {
      type: Object,
      default: {},
    },

    // ----------------- PHRASES "JE SUIS GÉNIAL" / "SOCIÉTÉ" -----------------
    phraseGenial: {
      type: String,
      default: "",
    },
    phraseSocieter: {
      type: String,
      default: "",
    },

    // ----------------- PORTRAIT -----------------
portrait: {
  type: String, // dataURL (base64) de l'image
  default: "",
},
  },
  {
    timestamps: true,
  }
);

const Character = mongoose.model("Character", CharacterSchema);

module.exports = Character;
