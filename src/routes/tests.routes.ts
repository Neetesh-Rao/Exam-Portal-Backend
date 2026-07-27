import { Router, Response } from "express";
import { Test } from "../models/Test.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Helper filter for single-tenant / company-scoped matching
const getTestFilter = (req: AuthRequest, testId?: string) => {
  const filter: any = {};
  if (testId) filter._id = testId;
  if (req.user?.companyId) {
    filter.$or = [
      { companyId: req.user.companyId },
      { companyId: { $exists: false } },
      { companyId: null },
    ];
  }
  return filter;
};

// GET /api/tests
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, search } = req.query;
      const filter = getTestFilter(req);
      if (status) filter.status = status;
      if (search) filter.title = { $regex: search as string, $options: "i" };

      const count = await Test.countDocuments(filter);
      const rows = await Test.find(filter).sort({ createdAt: -1 });
      const mapped = rows.map((t) => ({ ...t.toObject(), id: t._id.toString() }));

      return res.json({ tests: mapped, total: count });
    } catch (error) {
      console.error("Get Tests API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/tests
router.post(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, sections, totalDurationSeconds, passPercentage, proctoringConfig } = req.body;
      if (!title) return res.status(400).json({ error: "Title is required" });

      const test = await Test.create({
        companyId: req.user?.companyId || null,
        title,
        description: description || "",
        sections: sections || [],
        totalDurationSeconds: totalDurationSeconds || 3600,
        passPercentage: passPercentage || 50,
        proctoringConfig: proctoringConfig || {
          tabSwitchLimit: 3,
          fullScreenRequired: true,
          webcamRequired: false,
          disableCopyPaste: true,
          disableRightClick: true,
        },
        status: "draft",
        createdBy: req.user?.userId,
      });

      return res.status(201).json({ test: { ...test.toObject(), id: test._id.toString() } });
    } catch (error) {
      console.error("Create Test API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /api/tests/:id
router.get(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const testId = String(req.params.id);
      const filter = getTestFilter(req, testId);
      const test = await Test.findOne(filter);
      if (!test) return res.status(404).json({ error: "Test not found" });
      return res.json({ test: { ...test.toObject(), id: test._id.toString() } });
    } catch (error) {
      console.error("Get Test API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// PATCH /api/tests/:id
router.patch(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const testId = String(req.params.id);
      const filter = getTestFilter(req, testId);
      const test = await Test.findOneAndUpdate(
        filter,
        { $set: req.body },
        { new: true }
      );
      if (!test) return res.status(404).json({ error: "Test not found" });
      return res.json({ test: { ...test.toObject(), id: test._id.toString() } });
    } catch (error) {
      console.error("Update Test API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// DELETE /api/tests/:id
router.delete(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const testId = String(req.params.id);
      const filter = getTestFilter(req, testId);
      const test = await Test.findOneAndDelete(filter);
      if (!test) return res.status(404).json({ error: "Test not found" });
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete Test API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/tests/:id/publish
router.post(
  "/:id/publish",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const testId = String(req.params.id);
      const filter = getTestFilter(req, testId);
      const test = await Test.findOneAndUpdate(
        filter,
        { status: "published" },
        { new: true }
      );
      if (!test) return res.status(404).json({ error: "Test not found" });
      return res.json({ test: { ...test.toObject(), id: test._id.toString() } });
    } catch (error) {
      console.error("Publish Test API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
