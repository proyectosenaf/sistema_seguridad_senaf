import mongoose from "mongoose";
import VisitFeedback from "../models/VisitFeedback.js";
import { getFeedbackMetrics } from "../services/visitFeedback.service.js";
import Visita from "../visitas.model.js";
// si usas Cita también, impórtala cuando aplique
// import Cita from "../models/Cita.js";

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function canVisitorAnswerVisit(visita, reqUser) {
  if (!visita || !reqUser) return false;

  const userEmail = normalizeEmail(reqUser.email);
  const visitaEmail = normalizeEmail(
    visita?.correo ||
      visita?.email ||
      visita?.visitorEmail ||
      visita?.documentoCorreo
  );

  if (userEmail && visitaEmail && userEmail === visitaEmail) return true;

  const reqUserId = String(reqUser.userId || reqUser._id || "");
  const visitaUserId = String(visita?.visitorUserId || visita?.usuarioId || "");

  if (reqUserId && visitaUserId && reqUserId === visitaUserId) return true;

  return false;
}

function isVisitFinished(visita) {
  const status = String(
    visita?.estado || visita?.status || ""
  ).trim().toLowerCase();

  return [
    "finalizada",
    "finalizado",
    "completed",
    "completada",
    "cerrada",
    "cerrado",
    "salida registrada",
  ].includes(status);
}

export async function submitVisitFeedback(req, res, next) {
  try {
    const { visitaId, rating, comment = "", wouldRecommend = "" } = req.body || {};

    if (!visitaId) {
      throw httpError("La visita es requerida.", 400);
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      throw httpError("La calificación debe estar entre 1 y 5 estrellas.", 400);
    }

    const visita = await Visita.findById(visitaId);
    if (!visita) {
      throw httpError("La visita no existe.", 404);
    }

    if (!isVisitFinished(visita) && !visita.feedbackEnabled) {
      throw httpError("La visita aún no está habilitada para calificación.", 400);
    }

    if (!canVisitorAnswerVisit(visita, req.user)) {
      throw httpError("No tienes permiso para calificar esta visita.", 403);
    }

    const alreadyExists = await VisitFeedback.findOne({ visitaId: visita._id }).lean();
    if (alreadyExists) {
      throw httpError("Esta visita ya fue calificada.", 409);
    }

    const feedback = await VisitFeedback.create({
      visitaId: visita._id,
      citaId: visita.citaId || null,
      visitorUserId: req.user?.userId || req.user?._id || null,
      visitorEmail:
        normalizeEmail(req.user?.email) ||
        normalizeEmail(visita?.correo || visita?.email || visita?.visitorEmail),
      visitorName:
        visita?.nombreCompleto ||
        visita?.visitorName ||
        req.user?.name ||
        "",
      hostName: visita?.anfitrion || visita?.hostName || "",
      areaName: visita?.area || visita?.areaName || "",
      rating: numericRating,
      comment: String(comment || "").trim(),
      wouldRecommend: ["yes", "maybe", "no"].includes(wouldRecommend)
        ? wouldRecommend
        : "",
      source: "visitor_portal",
      answeredAt: new Date(),
    });

    visita.feedbackSubmitted = true;
    visita.feedbackScore = numericRating;
    visita.feedbackSubmittedAt = new Date();
    await visita.save();

    return res.status(201).json({
      ok: true,
      message: "Gracias por tu opinión.",
      data: feedback,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyPendingVisitFeedback(req, res, next) {
  try {
    const userEmail = normalizeEmail(req.user?.email);
    const userId = String(req.user?.userId || req.user?._id || "");

    const visits = await Visita.find({
      $or: [
        ...(userEmail ? [{ correo: userEmail }, { email: userEmail }, { visitorEmail: userEmail }] : []),
        ...(userId ? [{ visitorUserId: userId }, { usuarioId: userId }] : []),
      ],
      feedbackEnabled: true,
      feedbackSubmitted: { $ne: true },
    })
      .sort({ fechaSalida: -1, updatedAt: -1 })
      .lean();

    return res.json({
      ok: true,
      data: visits,
    });
  } catch (err) {
    next(err);
  }
}

export async function listVisitFeedback(req, res, next) {
  try {
    const {
      from = "",
      to = "",
      rating = "",
      withComment = "",
      q = "",
      page = 1,
      limit = 20,
    } = req.query || {};

    const match = {};

    if (from || to) {
      match.answeredAt = {};
      if (from) match.answeredAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) match.answeredAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    if (rating) {
      match.rating = Number(rating);
    }

    if (withComment === "true") {
      match.comment = { $exists: true, $ne: "" };
    }

    if (q) {
      match.$or = [
        { visitorName: { $regex: q, $options: "i" } },
        { visitorEmail: { $regex: q, $options: "i" } },
        { hostName: { $regex: q, $options: "i" } },
        { areaName: { $regex: q, $options: "i" } },
        { comment: { $regex: q, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      VisitFeedback.find(match)
        .sort({ answeredAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      VisitFeedback.countDocuments(match),
    ]);

    return res.json({
      ok: true,
      data: items,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getVisitFeedbackMetrics(req, res, next) {
  try {
    const { from = "", to = "", hostName = "", areaName = "" } = req.query || {};

    const metrics = await getFeedbackMetrics({
      mongoose,
      from,
      to,
      hostName,
      areaName,
    });

    return res.json({
      ok: true,
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
}