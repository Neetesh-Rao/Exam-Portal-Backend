import { Router, Response } from "express";
import { Notification } from "../models/Notification.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const notifications = await Notification.find({ userId: req.user?.userId })
        .sort({ createdAt: -1 })
        .limit(50);

      const mapped = notifications.map((n) => ({
        ...n.toObject(),
        id: n._id.toString(),
      }));

      return res.json({ notifications: mapped });
    } catch (error) {
      console.error("Get Notifications API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
