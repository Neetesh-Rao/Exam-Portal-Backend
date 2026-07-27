import mongoose, { Schema, Document } from "mongoose";

export interface ICandidate extends Document {
  companyId?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String },
    resumeUrl: { type: String },
    source: { type: String },
  },
  { timestamps: true }
);

export const Candidate = mongoose.models.Candidate || mongoose.model<ICandidate>("Candidate", CandidateSchema);
