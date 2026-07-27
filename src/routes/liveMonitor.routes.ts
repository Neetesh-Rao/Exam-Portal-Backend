import { Router, Response } from "express";
import { Submission } from "../models/Submission.js";
import { ViolationLog } from "../models/ViolationLog.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/live-monitor
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const submissions = await Submission.find({ companyId: req.user?.companyId })
        .select("-recordingSnapshots")
        .populate("candidateId")
        .populate("testId")
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean();

      const subIds = submissions.map((s: any) => s._id);
      const allViolations = await ViolationLog.find({ submissionId: { $in: subIds } }).sort({ createdAt: 1 }).lean();

      const violationsBySub: Record<string, any[]> = {};
      allViolations.forEach((v: any) => {
        const sId = v.submissionId.toString();
        if (!violationsBySub[sId]) violationsBySub[sId] = [];
        violationsBySub[sId].push(v);
      });

      const liveSessions = submissions.map((sub: any) => {
        const subIdStr = sub._id.toString();
        const violations = violationsBySub[subIdStr] || [];
        const lastViolation = violations.length > 0 ? violations[violations.length - 1] : null;

        return {
          id: subIdStr,
          candidateName: (sub.candidateId as any)?.name || "Unknown Candidate",
          candidateEmail: (sub.candidateId as any)?.email || "N/A",
          testTitle: (sub.testId as any)?.title || "Technical Assessment",
          status: sub.status,
          startedAt: sub.startedAt,
          submittedAt: sub.submittedAt,
          violationCount: violations.length,
          lastViolationType: lastViolation?.type || null,
          tabSwitchLimit: (sub.testId as any)?.proctoringConfig?.tabSwitchLimit || 3,
        };
      });

      return res.json({ sessions: liveSessions });
    } catch (error) {
      console.error("Live Monitor API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
