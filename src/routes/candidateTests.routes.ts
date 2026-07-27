import { Router, Response } from "express";
import { TestInvite } from "../models/TestInvite.js";
import { Candidate } from "../models/Candidate.js";
import { authenticateUser, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/candidate/tests
router.get("/tests", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const candidate = await Candidate.findById(req.user?.userId);
    let invites = [];

    if (candidate) {
      invites = await TestInvite.find({ candidateId: candidate._id })
        .populate("testId")
        .sort({ createdAt: -1 });
    } else {
      invites = await TestInvite.find()
        .populate("testId")
        .sort({ createdAt: -1 })
        .limit(20);
    }

    const mapped = invites.map((inv) => ({
      id: inv._id.toString(),
      token: inv.token,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      test: inv.testId
        ? {
            id: (inv.testId as any)._id.toString(),
            title: (inv.testId as any).title,
            description: (inv.testId as any).description,
            totalDurationSeconds: (inv.testId as any).totalDurationSeconds,
            passPercentage: (inv.testId as any).passPercentage,
          }
        : null,
    }));

    return res.json({ invites: mapped });
  } catch (error) {
    console.error("Candidate tests API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
