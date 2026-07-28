import { Router, Response } from "express";
import { Candidate } from "../models/Candidate.js";
import { Submission } from "../models/Submission.js";
import { TestInvite } from "../models/TestInvite.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/candidates
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter: any = {};
      if (req.user?.companyId) {
        filter.companyId = req.user.companyId;
      }
      const candidates = await Candidate.find(filter).sort({ createdAt: -1 });
      const mapped = candidates.map((c) => ({
        ...c.toObject(),
        id: c._id.toString(),
      }));

      return res.json({ candidates: mapped });
    } catch (error) {
      console.error("Candidates API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/candidates
router.post(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, email, phone, position, resumeUrl, source } = req.body;
      if (!name || !email) return res.status(400).json({ error: "Name and email are required" });

      const candidate = await Candidate.create({
        companyId: req.user?.companyId || null,
        name,
        email,
        phone,
        position,
        resumeUrl,
        source,
      });

      return res.status(201).json({ candidate: { ...candidate.toObject(), id: candidate._id.toString() } });
    } catch (error) {
      console.error("Candidates API POST error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /api/candidates/:id
router.get(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter: any = { _id: req.params.id };
      if (req.user?.companyId) {
        filter.companyId = req.user.companyId;
      }
      const candidate = await Candidate.findOne(filter);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const submissions = await Submission.find({ candidateId: candidate._id })
        .populate("testId")
        .sort({ createdAt: -1 });

      const mappedSubmissions = submissions.map((s) => ({
        ...s.toObject(),
        id: s._id.toString(),
      }));

      const invites = await TestInvite.find({ candidateId: candidate._id }).sort({ createdAt: -1 });

      const mappedInvites = invites.map((i) => ({
        ...i.toObject(),
        id: i._id.toString(),
      }));

      return res.json({
        candidate: { ...candidate.toObject(), id: candidate._id.toString() },
        submissions: mappedSubmissions,
        invites: mappedInvites,
      });
    } catch (error) {
      console.error("Get Candidate API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// PUT /api/candidates/:id
router.put(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter: any = { _id: req.params.id };
      if (req.user?.companyId) {
        filter.companyId = req.user.companyId;
      }

      const candidate = await Candidate.findOne(filter);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      const { name, email, phone, position, resumeUrl, source, status } = req.body;
      if (name !== undefined) candidate.name = name;
      if (email !== undefined) candidate.email = email;
      if (phone !== undefined) candidate.phone = phone;
      if (position !== undefined) candidate.position = position;
      if (resumeUrl !== undefined) candidate.resumeUrl = resumeUrl;
      if (source !== undefined) candidate.source = source;
      if (status !== undefined) candidate.status = status;

      await candidate.save();

      return res.json({ candidate: { ...candidate.toObject(), id: candidate._id.toString() } });
    } catch (error) {
      console.error("Update Candidate API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// DELETE /api/candidates/:id
router.delete(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const filter: any = { _id: req.params.id };
      if (req.user?.companyId) {
        filter.companyId = req.user.companyId;
      }

      const candidate = await Candidate.findOne(filter);
      if (!candidate) return res.status(404).json({ error: "Candidate not found" });

      // Delete associated invites too (clean up)
      await TestInvite.deleteMany({ candidateId: candidate._id });

      await candidate.deleteOne();

      return res.status(200).json({ message: "Candidate deleted successfully" });
    } catch (error) {
      console.error("Delete Candidate API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
