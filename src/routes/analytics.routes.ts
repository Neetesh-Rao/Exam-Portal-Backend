import { Router, Response } from "express";
import { Test } from "../models/Test.js";
import { Candidate } from "../models/Candidate.js";
import { Submission } from "../models/Submission.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/analytics/overview
router.get(
  "/overview",
  authenticateUser,
  requireRole(["super_admin", "admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const [totalTests, totalCandidates, totalSubmissions] = await Promise.all([
        Test.countDocuments({ companyId: req.user?.companyId }),
        Candidate.countDocuments({ companyId: req.user?.companyId }),
        Submission.countDocuments({ companyId: req.user?.companyId }),
      ]);

      const scoreAgg = await Submission.aggregate([
        {
          $match: {
            companyId: req.user?.companyId,
            status: { $in: ["submitted", "auto_submitted", "graded"] },
          },
        },
        {
          $group: {
            _id: null,
            avgScore: { $avg: { $ifNull: ["$finalScore", { $ifNull: ["$autoScore", 0] }] } },
          },
        },
      ]);
      const avgScore = scoreAgg.length > 0 ? Math.round(scoreAgg[0].avgScore || 0) : 0;

      return res.json({
        totalTests,
        totalCandidates,
        totalSubmissions,
        avgScore,
        recentActivity: [],
      });
    } catch (error) {
      console.error("Overview API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
