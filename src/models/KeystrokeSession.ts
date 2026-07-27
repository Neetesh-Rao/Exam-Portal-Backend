import mongoose, { Schema, Document } from "mongoose";

export interface IKeystrokeSession extends Document {
  submissionId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  totalKeystrokes: number;
  backspaceCount: number;
  pasteEventCount: number;
  avgTypingSpeedWpm: number;
  idleTimeSeconds: number;
  timeline: {
    timestampOffsetSec: number;
    action: string;
  }[];
}

const KeystrokeSessionSchema = new Schema<IKeystrokeSession>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    totalKeystrokes: { type: Number, default: 0 },
    backspaceCount: { type: Number, default: 0 },
    pasteEventCount: { type: Number, default: 0 },
    avgTypingSpeedWpm: { type: Number, default: 0 },
    idleTimeSeconds: { type: Number, default: 0 },
    timeline: [
      {
        timestampOffsetSec: { type: Number },
        action: { type: String },
      },
    ],
  }
);

export const KeystrokeSession = mongoose.models.KeystrokeSession || mongoose.model<IKeystrokeSession>("KeystrokeSession", KeystrokeSessionSchema);
