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

const CompetenceSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    score: Number,
    fromStat: String,
    locked: Boolean,
  },
  { _id: false }
);

const SpecialCompetenceSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    score: Number,
    locked: Boolean,
  },
  { _id: false }
);

const InventoryItemSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    quantity: Number,
    fromKit: Boolean,
    category: String,
    icon: String,
  },
  { _id: false }
);

const WeaponSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    damage: String,
    icon: String,
    validated: Boolean,
  },
  { _id: false }
);

const AlchemyPotionSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    effect: String,
    difficulty: String,
    quantity: Number,
  },
  { _id: false }
);

const MetaSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["draft", "editing", "validated"],
      default: "draft",
    },
    sheetMode: {
      type: String,
      enum: ["create", "edit", "validated"],
      default: "create",
    },
  },
  { _id: false }
);

const CharacterSchema = new mongoose.Schema(
  {
    // 🔐 Lien avec le user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Identité
    player: { type: String, default: "" },
    name: { type: String, default: "" }, // plus "required: true"
    age: { type: Number, min: 0 },
    profession: { type: String, default: "" },

    // Meta
    meta: { type: MetaSchema, default: () => ({}) },

    // Caracs
    stats: { type: [StatSchema], default: [] },
    statMode: {
      type: String,
      enum: ["3d6", "point-buy"],
      default: "3d6",
    },
    statPointsPool: { type: Number, default: 0 },

    // Compétences
    skillMode: {
      type: String,
      enum: ["ready", "custom"],
      default: "ready",
    },
    competences: { type: [CompetenceSchema], default: [] },
    specialCompetences: { type: [SpecialCompetenceSchema], default: [] },

    // Inventaire / armes / bourse
    inventory: { type: [InventoryItemSchema], default: [] },
    weapons: { type: [WeaponSchema], default: [] },
    purseFer: { type: Number, default: 0 },

    // XP & état de création
    xp: { type: Number, default: 0 },
    isCreationDone: { type: Boolean, default: false },

    // Alchimie
    isAlchemist: { type: Boolean, default: false },
    alchemyPotions: { type: [AlchemyPotionSchema], default: [] },

    // Phrases
    phraseGenial: { type: String, default: "" },
    phraseSociete: { type: String, default: "" },

    // 🎨 Portrait : c'est ici le champ important
    portrait: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Character", CharacterSchema);
