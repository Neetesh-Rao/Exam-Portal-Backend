import { Router, Response } from "express";
import { Question } from "../models/Question.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/questions
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const search = req.query.search as string;
      const query: any = { companyId: req.user?.companyId };
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      const questions = await Question.find(query).sort({ createdAt: -1 });
      const mapped = questions.map((q) => ({
        ...q.toObject(),
        id: q._id.toString(),
      }));

      return res.json({ questions: mapped });
    } catch (error) {
      console.error("Questions API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/questions
router.post(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body;
      const question = await Question.create({
        companyId: req.user?.companyId,
        title: body.title,
        description: body.description,
        type: body.type,
        difficulty: body.difficulty,
        marks: body.marks || 10,
        testCases: body.testCases || [],
        options: body.options || [],
        correctOptionIndex: body.correctOptionIndex,
        createdBy: req.user?.userId,
      });

      return res.status(201).json({ question: { ...question.toObject(), id: question._id.toString() } });
    } catch (error) {
      console.error("Questions API POST error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// GET /api/questions/:id
router.get(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const question = await Question.findOne({ _id: req.params.id, companyId: req.user?.companyId });
      if (!question) return res.status(404).json({ error: "Question not found" });

      return res.json({ question: { ...question.toObject(), id: question._id.toString() } });
    } catch (error) {
      console.error("Get Question API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// PATCH /api/questions/:id
router.patch(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const question = await Question.findOneAndUpdate(
        { _id: req.params.id, companyId: req.user?.companyId },
        { $set: req.body },
        { new: true }
      );
      if (!question) return res.status(404).json({ error: "Question not found" });

      return res.json({ question: { ...question.toObject(), id: question._id.toString() } });
    } catch (error) {
      console.error("Update Question API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// DELETE /api/questions/:id
router.delete(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const question = await Question.findOneAndDelete({ _id: req.params.id, companyId: req.user?.companyId });
      if (!question) return res.status(404).json({ error: "Question not found" });

      return res.json({ success: true });
    } catch (error) {
      console.error("Delete Question API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
