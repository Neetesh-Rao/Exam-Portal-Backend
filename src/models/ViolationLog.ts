import mongoose, { Schema, Document } from "mongoose";

export interface IViolationLog extends Document {
  submissionId: mongoose.Types.ObjectId;
  type: 'tab_switch' | 'fullscreen_exit' | 'copy_attempt' | 'paste_attempt' | 'right_click' | 'devtools_open' | 'no_face_detected' | 'multiple_faces';
  timestamp: Date;
  metadata?: any;
}

const ViolationLogSchema = new Schema<IViolationLog>(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    type: {
      type: String,
      enum: ['tab_switch', 'fullscreen_exit', 'copy_attempt', 'paste_attempt', 'right_click', 'devtools_open', 'no_face_detected', 'multiple_faces'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  }
);

export const ViolationLog = mongoose.models.ViolationLog || mongoose.model<IViolationLog>("ViolationLog", ViolationLogSchema);
