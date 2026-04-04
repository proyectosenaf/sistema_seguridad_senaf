import { Router } from "express";
import {
  submitVisitFeedback,
  getMyPendingVisitFeedback,
  listVisitFeedback,
  getVisitFeedbackMetrics,
} from "../controllers/visitFeedback.controller.js";

import { makeAuthMw } from "../../iam/utils/auth.util.js";

const router = Router();
const auth = makeAuthMw();

router.get("/mine/pending", auth, getMyPendingVisitFeedback);
router.post("/", auth, submitVisitFeedback);

// Admin / supervisor
router.get("/list", auth, listVisitFeedback);
router.get("/metrics", auth, getVisitFeedbackMetrics);

export default router;