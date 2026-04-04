import mongoose from "mongoose";

const VisitFeedbackSchema = new mongoose.Schema(
  {
    visitaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visita",
      required: true,
      unique: true,
      index: true,
    },

    visitorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },

    visitorName: {
      type: String,
      trim: true,
      default: "",
    },

    documento: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    hostName: {
      type: String,
      trim: true,
      default: "",
    },

    empresa: {
      type: String,
      trim: true,
      default: "",
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    wouldRecommend: {
      type: String,
      enum: ["yes", "maybe", "no", ""],
      default: "",
      index: true,
    },

    source: {
      type: String,
      enum: ["visitor_portal", "admin_capture", "public_link", "kiosk"],
      default: "visitor_portal",
    },

    answeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

VisitFeedbackSchema.index({ answeredAt: -1 });
VisitFeedbackSchema.index({ visitorEmail: 1, answeredAt: -1 });
VisitFeedbackSchema.index({ documento: 1, answeredAt: -1 });

const VisitFeedback =
  mongoose.models.VisitFeedback ||
  mongoose.model("VisitFeedback", VisitFeedbackSchema);

export default VisitFeedback;