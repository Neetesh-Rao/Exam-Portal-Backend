import { Router, Request, Response } from "express";
import crypto from "crypto";
import { TestInvite } from "../models/TestInvite.js";
import { Candidate } from "../models/Candidate.js";
import { Test } from "../models/Test.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";
import { sendCandidateInviteEmail } from "../lib/email.js";

const router = Router();

// GET /api/invites - List invites
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const invites = await TestInvite.find()
        .populate("testId")
        .populate("candidateId")
        .sort({ createdAt: -1 })
        .lean();

      return res.json({
        invites: invites.map((inv: any) => ({
          ...inv,
          id: inv._id.toString(),
          test: inv.testId ? { ...inv.testId, id: inv.testId._id.toString() } : null,
          candidate: inv.candidateId ? { ...inv.candidateId, id: inv.candidateId._id.toString() } : null,
        })),
      });
    } catch (error) {
      console.error("Get Invites API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/invites/bulk - Send invites to candidates with custom expiration
router.post(
  "/bulk",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { testId, candidateEmails, expiresInSeconds, expiresInMinutes, expiresInHours, expiresInDays } = req.body;

      if (!testId || !candidateEmails || !Array.isArray(candidateEmails) || candidateEmails.length === 0) {
        return res.status(400).json({ error: "Test ID and candidate emails are required" });
      }

      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ error: "Test not found" });

      const expiresAt = new Date();
      if (expiresInSeconds && Number(expiresInSeconds) > 0) {
        expiresAt.setTime(expiresAt.getTime() + Number(expiresInSeconds) * 1000);
      } else if (expiresInMinutes && Number(expiresInMinutes) > 0) {
        expiresAt.setTime(expiresAt.getTime() + Number(expiresInMinutes) * 60 * 1000);
      } else if (expiresInHours && Number(expiresInHours) > 0) {
        expiresAt.setTime(expiresAt.getTime() + Number(expiresInHours) * 60 * 60 * 1000);
      } else {
        const days = Number(expiresInDays) || 7;
        expiresAt.setTime(expiresAt.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const createdInvites = [];
      const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

      for (const email of candidateEmails) {
        const cleanEmail = String(email).trim().toLowerCase();
        let candidate = await Candidate.findOne({ email: cleanEmail });
        if (!candidate) {
          candidate = await Candidate.create({
            companyId: null,
            email: cleanEmail,
            name: cleanEmail.split("@")[0],
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

        const inviteLink = `${clientUrl}/take-test/${token}`;

        // Send Email asynchronously via Nodemailer
        sendCandidateInviteEmail({
          to: candidate.email,
          candidateName: candidate.name,
          testTitle: test.title,
          inviteLink,
          expiresAt,
        }).catch((err) => console.error("Async email error:", err));

        createdInvites.push({
          token: invite.token,
          email: candidate.email,
          inviteLink,
          expiresAt,
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
    const rawToken = String(req.params.token || "").replace(/\//g, "").trim();
    const invite = await TestInvite.findOne({ token: rawToken });
    if (!invite) return res.json({ error: "Invalid invitation link." });

    if (invite.status === "expired" || new Date() > new Date(invite.expiresAt)) {
      if (invite.status !== "expired") {
        invite.status = "expired";
        await invite.save();
      }
      return res.json({ error: "This invitation link has expired." });
    }

    if (invite.status === "completed") {
      return res.json({ error: "This test has already been completed.", alreadySubmitted: true });
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
    console.error("Validate Invite API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
