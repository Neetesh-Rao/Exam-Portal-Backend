import mongoose from "mongoose";
import { Router, Response } from "express";
import { Question } from "../models/Question.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

const getQuestionFilter = (req: AuthRequest, questionId?: string) => {
  const filter: any = {};
  if (questionId) {
    if (mongoose.Types.ObjectId.isValid(questionId)) {
      filter._id = new mongoose.Types.ObjectId(questionId);
    } else {
      filter._id = questionId;
    }
  }
  if (req.user?.companyId) {
    filter.$or = [
      { companyId: req.user.companyId },
      { companyId: { $exists: false } },
      { companyId: null },
    ];
  }
  return filter;
};

// GET /api/questions
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const search = req.query.search as string;
      const query = getQuestionFilter(req);
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
        companyId: req.user?.companyId || null,
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
      const questionId = String(req.params.id);
      const filter = getQuestionFilter(req, questionId);
      const question = await Question.findOne(filter);
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
  requireRole(["super_admin", "admin", "recruiter"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const questionId = String(req.params.id);
      const filter = getQuestionFilter(req, questionId);
      const question = await Question.findOneAndUpdate(
        filter,
        { $set: req.body },
        { returnDocument: "after" }
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
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const questionId = String(req.params.id);
      console.log(`Deleting question ID: ${questionId}`);

      // Try deleting by _id or filter
      let question = null;
      if (mongoose.Types.ObjectId.isValid(questionId)) {
        question = await Question.findByIdAndDelete(questionId);
      } else {
        const filter = getQuestionFilter(req, questionId);
        question = await Question.findOneAndDelete(filter);
      }

      if (!question) {
        console.warn(`Question not found for deletion: ${questionId}`);
        return res.status(404).json({ error: "Question not found" });
      }

      console.log(`Successfully deleted question: ${questionId}`);
      return res.json({ success: true, message: "Question deleted successfully" });
    } catch (error) {
      console.error("Delete Question API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
