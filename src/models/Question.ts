import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion extends Document {
  companyId?: mongoose.Types.ObjectId;
  type: 'mcq_single' | 'mcq_multi' | 'text_area' | 'fill_blank' | 'true_false' | 'match_following' | 'coding' | 'file_upload' | 'audio_response';
  title: string;
  description?: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  correctTextAnswer?: string;
  codeConfig?: { language: string; starterCode: string; disablePaste: boolean };
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  marks: number;
  negativeMarks: number;
  timeLimitSeconds?: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    type: {
      type: String,
      enum: ['mcq_single', 'mcq_multi', 'text_area', 'fill_blank', 'true_false', 'match_following', 'coding', 'file_upload', 'audio_response'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    options: [{ id: String, text: String, isCorrect: Boolean }],
    correctTextAnswer: { type: String },
    codeConfig: {
      language: { type: String },
      starterCode: { type: String },
      disablePaste: { type: Boolean },
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    tags: [{ type: String }],
    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    timeLimitSeconds: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Question = mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);
