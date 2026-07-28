import mongoose, { Schema, Document } from "mongoose";

export interface ITest extends Document {
  companyId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  sections: {
    title: string;
    questionIds: mongoose.Types.ObjectId[];
    timeLimitSeconds?: number;
    randomizeQuestions: boolean;
  }[];
  totalDurationSeconds: number;
  totalMarks?: number;
  passPercentage: number;
  proctoringConfig: {
    tabSwitchLimit: number;
    fullScreenRequired: boolean;
    webcamRequired: boolean;
    disableCopyPaste: boolean;
    disableRightClick: boolean;
  };
  status: 'draft' | 'published' | 'archived';
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TestSchema = new Schema<ITest>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    title: { type: String, required: true },
    description: { type: String },
    sections: [
      {
        title: { type: String, required: true },
        questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
        timeLimitSeconds: { type: Number },
        randomizeQuestions: { type: Boolean, default: false },
      },
    ],
    totalDurationSeconds: { type: Number, required: true },
    totalMarks: { type: Number },
    passPercentage: { type: Number, required: true, default: 50 },
    proctoringConfig: {
      tabSwitchLimit: { type: Number, default: 3 },
      fullScreenRequired: { type: Boolean, default: true },
      webcamRequired: { type: Boolean, default: false },
      disableCopyPaste: { type: Boolean, default: true },
      disableRightClick: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Test = mongoose.models.Test || mongoose.model<ITest>("Test", TestSchema);
