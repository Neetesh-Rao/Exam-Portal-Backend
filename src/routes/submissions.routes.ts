import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { Submission } from "../models/Submission.js";
import { Candidate } from "../models/Candidate.js";
import { Test } from "../models/Test.js";
import { Question } from "../models/Question.js";
import { TestInvite } from "../models/TestInvite.js";
import { ViolationLog } from "../models/ViolationLog.js";
import { authenticateUser, requireRole, AuthRequest } from "../middleware/auth.js";
import { uploadVideoToCloudinary, uploadImageToCloudinary } from "../lib/cloudinary.js";

const router = Router();

// Use memory storage — Vercel serverless filesystem is read-only at /var/task
// Files are buffered in memory and written to os.tmpdir() only when uploading to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// GET /api/submissions
router.get(
  "/",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      let query: any = {};
      if (req.user?.companyId) {
        query = {
          $or: [
            { companyId: req.user.companyId },
            { companyId: { $exists: false } },
            { companyId: null },
          ],
        };
      }

      const submissions = await Submission.find(query)
        .select("-recordingSnapshots")
        .populate("candidateId")
        .populate("testId")
        .sort({ createdAt: -1 })
        .lean();

      const mapped = await Promise.all(
        submissions.map(async (s: any) => {
          const candObj = s.candidateId ? s.candidateId : null;
          const testObj = s.testId ? s.testId : null;

          let totalMarks = 0;
          if (testObj && testObj.sections) {
            const qIds = testObj.sections.flatMap((sec: any) => sec.questionIds || []);
            if (qIds.length > 0) {
              const qDocs = await Question.find({ _id: { $in: qIds } }).select("marks").lean();
              totalMarks = (qDocs as any[]).reduce((sum: number, q: any) => sum + (q.marks || 1), 0);
            }
          }
          if (totalMarks === 0) totalMarks = 100;

          return {
            ...s,
            id: s._id.toString(),
            candidate: candObj ? { ...candObj, id: candObj._id ? candObj._id.toString() : "" } : null,
            test: testObj ? { ...testObj, id: testObj._id ? testObj._id.toString() : "" } : null,
            finalScore: s.finalScore ?? s.autoScore ?? 0,
            autoScore: s.autoScore ?? 0,
            manualScore: s.manualScore ?? 0,
            totalMarks,
          };
        })
      );

      return res.json({ submissions: mapped });
    } catch (error) {
      console.error("Submissions API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/submissions/start
router.post("/start", async (req: Request, res: Response) => {
  try {
    const rawToken = String(req.body.token || "").replace(/\//g, "").trim();
    if (!rawToken) return res.status(400).json({ error: "Token is required" });

    const invite = await TestInvite.findOne({ token: rawToken });
    if (!invite) return res.json({ error: "Invalid token" });

    if (invite.status === "expired" || new Date() > new Date(invite.expiresAt)) {
      if (invite.status !== "expired") {
        invite.status = "expired";
        await invite.save();
      }
      return res.json({ error: "Invitation expired", expired: true });
    }

    if (invite.status === "completed") {
      return res.json({ error: "Test already completed", alreadySubmitted: true });
    }

    const test = await Test.findById(invite.testId);
    if (!test) return res.json({ error: "Test not found" });

    // Look up submission by inviteId OR (testId + candidateId)
    let submission = await Submission.findOne({
      $or: [
        { inviteId: invite._id },
        { testId: invite.testId, candidateId: invite.candidateId },
      ],
    });

    if (!submission) {
      try {
        const createPayload: any = {
          testId: invite.testId,
          candidateId: invite.candidateId,
          inviteId: invite._id,
          answers: [],
          status: "in_progress",
          startedAt: new Date(),
        };
        // Only set companyId when it exists (single-tenant: may be absent)
        if (test.companyId) {
          createPayload.companyId = test.companyId;
        }

        submission = await Submission.create(createPayload);

        invite.status = "started";
        await invite.save();
      } catch (err: any) {
        if (err.code === 11000) {
          submission = await Submission.findOne({ testId: invite.testId, candidateId: invite.candidateId });
        } else {
          throw err;
        }
      }
    }

    if (submission && (submission.status === "submitted" || submission.status === "auto_submitted" || submission.status === "graded")) {
      if (invite.status !== "completed") {
        submission.status = "in_progress";
        submission.answers = [];
        submission.startedAt = new Date();
        submission.submittedAt = undefined;
        submission.inviteId = invite._id;
        await submission.save();

        invite.status = "started";
        await invite.save();
      } else {
        return res.json({ error: "Test already completed", alreadySubmitted: true });
      }
    }

    const questions: any[] = [];
    if (test && test.sections) {
      for (const section of test.sections) {
        if (section.questionIds && section.questionIds.length > 0) {
          const qDocs = await Question.find({ _id: { $in: section.questionIds } });
          for (const q of qDocs) {
            const qObj = q.toObject();
            qObj.id = qObj._id.toString();
            if (qObj.options) {
              qObj.options = qObj.options.map((o: any) => ({
                id: o.id,
                text: o.text,
              }));
            }
            questions.push(qObj);
          }
        }
      }
    }

    return res.status(201).json({
      submission: { ...submission.toObject(), id: submission._id.toString() },
      test: test ? { ...test.toObject(), id: test._id.toString() } : null,
      questions,
    });
  } catch (error) {
    console.error("Submission start error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/submissions/:id
router.get(
  "/:id",
  authenticateUser,
  requireRole(["super_admin", "admin", "recruiter", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const submission = await Submission.findById(req.params.id)
        .populate("testId")
        .populate("candidateId")
        .lean();

      if (!submission) return res.status(404).json({ error: "Submission not found" });

      const violations = await ViolationLog.find({ submissionId: submission._id }).lean();

      const test: any = submission.testId;
      let questions: any[] = [];
      if (test && test.sections) {
        const qIds = test.sections.flatMap((s: any) => s.questionIds || []);
        questions = await Question.find({ _id: { $in: qIds } }).lean();
      }

      const candObj = submission.candidateId as any;
      const testObj = submission.testId as any;

      // Calculate real totalMarks from question marks (sum of all question marks in test)
      const totalMarks = questions.length > 0
        ? questions.reduce((sum: number, q: any) => sum + (q.marks || 1), 0)
        : (testObj?.totalMarks || 100);

      const mappedSub = {
        ...submission,
        id: submission._id.toString(),
        totalMarks,
        candidate: candObj ? { ...candObj, id: candObj._id ? candObj._id.toString() : "" } : null,
        test: testObj ? { ...testObj, id: testObj._id ? testObj._id.toString() : "" } : null,
        violations: violations.map((v) => ({ ...v, id: v._id.toString() })),
        questions: questions.map((q) => ({ ...q, id: q._id.toString() })),
      };

      return res.json({
        submission: mappedSub,
        candidate: mappedSub.candidate,
        test: mappedSub.test,
        questions: mappedSub.questions,
        violations: mappedSub.violations,
        totalMarks,
      });
    } catch (error) {
      console.error("Get Submission API error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/submissions/:id/upload-full-recordings (Lightweight fallback)
router.post(
  "/:id/upload-full-recordings",
  upload.fields([
    { name: "cameraVideo", maxCount: 1 },
    { name: "screenVideo", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    return res.json({
      success: true,
      message: "Proctoring active with periodic webcam & screen snapshots",
    });
  }
);

// GET /api/submissions/:id/recordings - Fetch all historical recordings & snapshots for a submission
router.get("/:id/recordings", async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.id;
    const submission = await Submission.findById(submissionId)
      .populate("candidateId", "name email avatar")
      .populate("testId", "title description");

    if (!submission) return res.status(404).json({ error: "Submission not found" });

    const snapshots = submission.recordingSnapshots || [];
    const history = submission.recordingsHistory || [];

    const unifiedRecordings = [
      ...(submission.videoRecordingUrl ? [{
        type: "camera",
        url: submission.videoRecordingUrl,
        timestamp: submission.startedAt || submission.createdAt,
        title: "Candidate Camera Capture",
      }] : []),
      ...(submission.screenRecordingUrl ? [{
        type: "screen",
        url: submission.screenRecordingUrl,
        timestamp: submission.submittedAt || submission.createdAt,
        title: "Candidate Screen Capture",
      }] : []),
      ...history.map((h: any) => ({
        type: h.type,
        url: h.url,
        timestamp: h.timestamp,
        title: `${h.type.toUpperCase()} Stream — ${h.event || "Proctoring Record"}`,
      })),
      ...snapshots.map((s: any) => ({
        type: "snapshot",
        url: s.imageUrl,
        timestamp: s.timestamp,
        title: `Webcam Snapshot — ${s.event || "Frame Capture"}`,
      })),
    ];

    return res.json({
      submissionId: submission._id.toString(),
      candidate: submission.candidateId,
      test: submission.testId,
      videoRecordingUrl: submission.videoRecordingUrl,
      screenRecordingUrl: submission.screenRecordingUrl,
      recordingsHistory: submission.recordingsHistory || [],
      snapshots: submission.recordingSnapshots || [],
      unifiedRecordings,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error("Get recordings API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// PATCH /api/submissions/:id/answer
router.patch("/:id/answer", async (req: Request, res: Response) => {
  try {
    const { questionId, answerText, selectedOptionIds, codeAnswer, isMarkedForReview } = req.body;
    if (!questionId) return res.status(400).json({ error: "Question ID is required" });

    const submission = await Submission.findById(req.params.id).select("status answers");
    if (!submission) return res.status(404).json({ error: "Submission not found" });

    if (submission.status !== "in_progress") {
      return res.status(403).json({ error: "Cannot update answer for a completed submission" });
    }

    const qObjId = new mongoose.Types.ObjectId(questionId);
    const existingIndex = submission.answers.findIndex(
      (a: any) => a.questionId.toString() === questionId
    );

    if (existingIndex > -1) {
      const updateFields: Record<string, any> = {};
      if (answerText !== undefined) updateFields[`answers.${existingIndex}.answerText`] = answerText;
      if (selectedOptionIds !== undefined) updateFields[`answers.${existingIndex}.selectedOptionIds`] = selectedOptionIds;
      if (codeAnswer !== undefined) updateFields[`answers.${existingIndex}.codeAnswer`] = codeAnswer;
      if (isMarkedForReview !== undefined) updateFields[`answers.${existingIndex}.isMarkedForReview`] = isMarkedForReview;

      await Submission.updateOne({ _id: req.params.id }, { $set: updateFields });
    } else {
      await Submission.updateOne(
        { _id: req.params.id },
        {
          $push: {
            answers: {
              questionId: qObjId,
              answerText,
              selectedOptionIds,
              codeAnswer,
              isMarkedForReview: isMarkedForReview || false,
              timeSpentSeconds: 0,
            },
          },
        }
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Save answer error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/submissions/:id/grade
router.post(
  "/:id/grade",
  authenticateUser,
  requireRole(["super_admin", "admin", "interviewer"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { questionGrades, manualScore } = req.body;
      const submission = await Submission.findById(req.params.id).populate("testId");
      if (!submission) return res.status(404).json({ error: "Submission not found" });

      const testObj: any = submission.testId;
      let totalMarks = 100;
      if (testObj && testObj.sections) {
        const qIds = testObj.sections.flatMap((sec: any) => sec.questionIds || []);
        if (qIds.length > 0) {
          const qDocs = await Question.find({ _id: { $in: qIds } }).select("marks").lean();
          totalMarks = (qDocs as any[]).reduce((sum: number, q: any) => sum + (q.marks || 1), 0) || 100;
        }
      }

      if (Array.isArray(questionGrades) && questionGrades.length > 0) {
        // Per-question grading: validate each question's marks against its max
        const qIds = questionGrades.map((qg: any) => qg.questionId);
        const questions = await Question.find({ _id: { $in: qIds } }).select("marks").lean();
        const qMap = new Map((questions as any[]).map((q: any) => [q._id.toString(), q]));

        let computedScore = 0;
        for (const answer of (submission as any).answers) {
          const qIdStr = answer.questionId.toString();
          const qObj: any = qMap.get(qIdStr);
          const qMaxMarks = qObj?.marks || 1;
          const gradeItem = questionGrades.find((qg: any) => String(qg.questionId) === qIdStr);
          if (gradeItem !== undefined) {
            // Clamp: 0 <= marks <= question's own max marks
            const assigned = Math.min(qMaxMarks, Math.max(0, Number(gradeItem.marksObtained) || 0));
            answer.marksObtained = assigned;
          }
          computedScore += (answer.marksObtained || 0);
        }

        // Final score must not exceed total test marks
        submission.finalScore = Math.min(totalMarks, Math.max(0, computedScore));
        submission.manualScore = Math.max(0, submission.finalScore - (submission.autoScore || 0));
      } else {
        // Simple manual total override
        const assignedManual = Math.max(0, Number(manualScore) || 0);
        const newFinal = Math.min(totalMarks, (submission.autoScore || 0) + assignedManual);
        submission.manualScore = assignedManual;
        submission.finalScore = newFinal;
      }

      submission.status = "graded";
      await submission.save();

      return res.json({ success: true, submission: { ...submission.toObject(), id: submission._id.toString(), totalMarks } });
    } catch (error) {
      console.error("Grade submission error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// POST /api/submissions/:id/violation
router.post("/:id/violation", async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: "Violation type is required" });

    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: "Submission not found" });

    await ViolationLog.create({
      submissionId: submission._id,
      testId: submission.testId,
      candidateId: submission.candidateId,
      type,
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error("Violation log error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/submissions/:id/webcam-snapshot
router.post("/:id/webcam-snapshot", async (req: Request, res: Response) => {
  try {
    const { imageUrl, event } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "Image URL/data is required" });

    const idStr = String(req.params.id);
    const subId = mongoose.Types.ObjectId.isValid(idStr)
      ? new mongoose.Types.ObjectId(idStr)
      : idStr;

    // Convert base64 image data to Cloudinary CDN URL if needed
    let finalImageUrl = imageUrl;
    if (typeof imageUrl === "string" && imageUrl.startsWith("data:image/")) {
      try {
        finalImageUrl = await uploadImageToCloudinary(imageUrl, "bitmax_webcam_snapshots");
      } catch (e) {
        console.warn("Snapshot Cloudinary upload error, storing base64 fallback:", e);
      }
    }

    await Submission.updateOne(
      { _id: subId },
      {
        $push: {
          recordingSnapshots: {
            $each: [
              {
                timestamp: new Date(),
                imageUrl: finalImageUrl,
                event: event || "snapshot",
              },
            ],
            $slice: -50,
          },
        },
      }
    );

    return res.status(201).json({ success: true, imageUrl: finalImageUrl });
  } catch (error) {
    console.error("Webcam snapshot API error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/submissions/:id/submit
router.post("/:id/submit", async (req: Request, res: Response) => {
  try {
    const { autoSubmitted } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: "Submission not found" });

    if (submission.status !== "in_progress") {
      return res.status(200).json({ success: true, message: "Test already submitted", submission });
    }

    const qIds = submission.answers.map((a: any) => a.questionId).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).select("type options marks");
    const qMap = new Map(questions.map((q: any) => [q._id.toString(), q]));

    let autoScore = 0;
    for (const answer of (submission as any).answers) {
      const question = qMap.get(answer.questionId?.toString());
      if (!question) continue;

      if (["mcq_single", "mcq_multi", "true_false"].includes(question.type)) {
        const correctOptions = question.options?.filter((o: any) => o.isCorrect).map((o: any) => o.id) || [];
        const selectedOptions = answer.selectedOptionIds || [];

        if (
          correctOptions.length === selectedOptions.length &&
          correctOptions.every((val: any) => selectedOptions.includes(val))
        ) {
          answer.marksObtained = question.marks || 1;
          autoScore += (question.marks || 1);
        } else {
          answer.marksObtained = 0;
        }
      } else {
        // Text/coding/fill_blank — awaits manual grading
        answer.marksObtained = 0;
      }
    }

    submission.autoScore = autoScore;
    submission.finalScore = autoScore;
    submission.status = autoSubmitted ? "auto_submitted" : "submitted";
    submission.submittedAt = new Date();
    await submission.save();

    if (submission.inviteId) {
      const invite = await TestInvite.findById(submission.inviteId);
      if (invite) {
        invite.status = "completed";
        await invite.save();
      }
    }

    return res.status(200).json({ success: true, submission: { ...submission.toObject(), id: submission._id.toString() } });
  } catch (error) {
    console.error("Submit test error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
