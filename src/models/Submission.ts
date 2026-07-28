import mongoose, { Schema, Document } from "mongoose";

export interface IRecordingHistoryItem {
  type: "camera" | "screen" | "snapshot";
  url: string;
  timestamp: Date;
  event?: string;
}

export interface ISubmission extends Document {
  companyId?: mongoose.Types.ObjectId;
  testId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  inviteId?: mongoose.Types.ObjectId;
  answers: {
    questionId: mongoose.Types.ObjectId;
    answerText?: string;
    selectedOptionIds?: string[];
    codeAnswer?: string;
    isMarkedForReview?: boolean;
    timeSpentSeconds?: number;
  }[];
  recordingSnapshots?: {
    timestamp: Date;
    imageUrl: string;
    event?: string;
  }[];
  recordingsHistory?: IRecordingHistoryItem[];
  videoRecordingUrl?: string;
  screenRecordingUrl?: string;
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
  status: "in_progress" | "submitted" | "auto_submitted" | "graded";
  startedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: false },
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: "Candidate", required: true },
    inviteId: { type: Schema.Types.ObjectId, ref: "TestInvite", required: false },
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
        answerText: { type: String },
        selectedOptionIds: [{ type: String }],
        codeAnswer: { type: String },
        isMarkedForReview: { type: Boolean, default: false },
        timeSpentSeconds: { type: Number, default: 0 },
      },
    ],
    recordingSnapshots: [
      {
        timestamp: { type: Date, default: Date.now },
        imageUrl: { type: String, required: true },
        event: { type: String, default: "snapshot" },
      },
    ],
    recordingsHistory: [
      {
        type: { type: String, enum: ["camera", "screen", "snapshot"], required: true },
        url: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        event: { type: String },
      },
    ],
    videoRecordingUrl: { type: String },
    screenRecordingUrl: { type: String },
    autoScore: { type: Number },
    manualScore: { type: Number },
    finalScore: { type: Number },
    status: {
      type: String,
      enum: ["in_progress", "submitted", "auto_submitted", "graded"],
      default: "in_progress",
    },
    startedAt: { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

SubmissionSchema.index({ testId: 1, candidateId: 1 }, { unique: true });
SubmissionSchema.index({ companyId: 1, status: 1 });
SubmissionSchema.index({ inviteId: 1 });
SubmissionSchema.index({ createdAt: -1 });

export const Submission = mongoose.models.Submission || mongoose.model<ISubmission>("Submission", SubmissionSchema);
