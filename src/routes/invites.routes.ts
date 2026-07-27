import { Router, Request, Response } from "express";
import crypto from "crypto";
import { TestInvite } from "../models/TestInvite.js";
import { Test } from "../models/Test.js";
import { Candidate } from "../models/Candidate.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/invites
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const invites = await TestInvite.find()
        .populate("candidateId")
        .populate("testId")
        .sort({ createdAt: -1 })
        .limit(50);

      const mapped = invites.map((i) => ({
        ...i.toObject(),
        id: i._id.toString(),
        test: i.testId ? { ...(i.testId as any).toObject(), id: (i.testId as any)._id.toString() } : null,
        candidate: i.candidateId ? { ...(i.candidateId as any).toObject(), id: (i.candidateId as any)._id.toString() } : null,
      }));

      return res.json({ invites: mapped });
    } catch (error) {
      console.error("Get Invites API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/invites/bulk
router.post(
  "/bulk",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { testId, candidateEmails, expiresInDays = 7 } = req.body;
      if (!testId || !candidateEmails || !candidateEmails.length) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const test = await Test.findOne({ _id: testId, companyId: req.user?.companyId });
      if (!test) return res.status(404).json({ error: "Test not found" });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const createdInvites = [];

      for (const email of candidateEmails) {
        let candidate = await Candidate.findOne({ email, companyId: req.user?.companyId });
        if (!candidate) {
          candidate = await Candidate.create({
            companyId: req.user?.companyId,
            email,
            name: email.split("@")[0],
          });
        }

        const token = crypto.randomBytes(32).toString("hex");

        const invite = await TestInvite.create({
          testId: test._id,
          candidateId: candidate._id,
          token,
          expiresAt,
          status: "invited",
        });

        createdInvites.push({
          token: invite.token,
          email: candidate.email,
        });
      }

      return res.status(201).json({ invites: createdInvites });
    } catch (error) {
      console.error("Bulk Invite API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /api/invites/:token/validate
router.get("/:token/validate", async (req: Request, res: Response) => {
  try {
    const invite = await TestInvite.findOne({ token: req.params.token });
    if (!invite) return res.json({ error: "Invalid invitation link." });

    if (invite.status === "expired" || new Date() > new Date(invite.expiresAt)) {
      if (invite.status !== "expired") {
        invite.status = "expired";
        await invite.save();
      }
      return res.json({ error: "This invitation link has expired." });
    }

    if (invite.status === "completed") {
      return res.json({ error: "This test has already been completed." });
    }

    const test = await Test.findById(invite.testId);
    if (!test) return res.json({ error: "The associated test could not be found." });

    const candidate = await Candidate.findById(invite.candidateId);
    if (!candidate) return res.json({ error: "Candidate record not found." });

    return res.json({
      invite: { ...invite.toObject(), id: invite._id.toString() },
      test: { ...test.toObject(), id: test._id.toString() },
      candidate: { ...candidate.toObject(), id: candidate._id.toString() },
    });
  } catch (error) {
    console.error("Invite validate API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
