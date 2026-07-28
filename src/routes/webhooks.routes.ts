import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Candidate } from "../models/Candidate.js";

const router = Router();

// ─── HMAC Signature Verification ──────────────────────────────────────────────
function verifyWebhookSignature(req: Request): boolean {
  const receivedSignature = req.headers["x-webhook-signature"] as string;
  const secret = process.env.WEBHOOK_SECRET;

  // If no secret is configured, skip verification (dev mode)
  if (!secret) {
    console.warn("⚠️  WEBHOOK_SECRET not set — skipping signature verification (dev mode)");
    return true;
  }

  if (!receivedSignature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  try {
    // timingSafeEqual prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false; // buffer length mismatch
  }
}

// ─── POST /api/webhooks/crm-candidate ─────────────────────────────────────────
// CRM calls this endpoint after candidate fills onboarding form
router.post("/crm-candidate", async (req: Request, res: Response) => {
  try {
    // 1. Verify signature
    if (!verifyWebhookSignature(req)) {
      console.warn("Webhook: Invalid signature received");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    // 2. Validate required fields
    const { name, email, phone, position, companyId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }

    // 3. Duplicate check — if same email already exists, return existing candidate
    let candidate = await Candidate.findOne({ email: email.toLowerCase().trim() });
    let isNew = false;

    if (!candidate) {
      // 4. Create new candidate
      candidate = await Candidate.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || undefined,
        position: position?.trim() || undefined,
        source: "crm_onboarding_form",
        status: "pending_invite",
        companyId: companyId || undefined,
      });
      isNew = true;
      console.log(`✅ CRM Webhook: New candidate created — ${email}`);
    } else {
      console.log(`ℹ️  CRM Webhook: Candidate already exists — ${email} (skipping duplicate)`);
    }

    // 5. Real-time socket emit → admin dashboard updates instantly
    const io = req.app.get("io");
    if (io) {
      io.emit("candidate:added", {
        ...candidate.toObject(),
        id: candidate._id.toString(),
      });
    }

    return res.status(200).json({
      status: "success",
      isNew,
      candidateId: candidate._id.toString(),
    });
  } catch (error) {
    console.error("CRM Webhook error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
