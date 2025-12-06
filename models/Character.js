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
    meta: {
      status: { type: String, default: "draft" },
    },
    player: { type: String, default: "" },
    name: { type: String, required: true },
    profession: { type: String, default: "" },
    age: { type: Number, default: null },

    stats: [StatSchema],
    diceRolls: { type: Object, default: {} },

    statMode: { type: String, default: "3d6" },
    statPointsPool: { type: Number, default: 0 },
    skillMode: { type: String, default: "ready" },
    isCreationDone: { type: Boolean, default: false },

    xp: { type: Number, default: 0 },
    competences: { type: Array, default: [] },
    specialCompetences: [SpecialCompetenceSchema],
  },
  {
    timestamps: true,
  }
);

const Character = mongoose.model("Character", CharacterSchema);

module.exports = Character;
