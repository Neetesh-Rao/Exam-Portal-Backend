import mongoose, { Schema, Document } from "mongoose";

export interface ITestInvite extends Document {
  testId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  status: 'invited' | 'started' | 'completed' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

const TestInviteSchema = new Schema<ITestInvite>(
  {
    testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['invited', 'started', 'completed', 'expired'],
      default: 'invited',
    },
  },
  { timestamps: true }
);

export const TestInvite = mongoose.models.TestInvite || mongoose.model<ITestInvite>("TestInvite", TestInviteSchema);
