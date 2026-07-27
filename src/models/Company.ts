import mongoose, { Schema, Document } from "mongoose";

export interface ICompany extends Document {
  name: string;
  logoUrl?: string;
  plan: 'free' | 'pro' | 'enterprise';
  ownerId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true },
    logoUrl: { type: String },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Company = mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema);
