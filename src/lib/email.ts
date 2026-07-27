import nodemailer from "nodemailer";

export async function sendCandidateInviteEmail({
  to,
  candidateName,
  testTitle,
  inviteLink,
  expiresAt,
}: {
  to: string;
  candidateName: string;
  testTitle: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (!emailUser || !emailPass) {
    console.warn("Nodemailer configuration missing in .env (EMAIL_USER, EMAIL_PASS). Skipping email dispatch.");
    return false;
  }

  const from = `"BITMAX Technology (P) Ltd" <${emailUser}>`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const formattedExpiry = new Date(expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #0284c7; margin: 0;">BITMAX Technology (P) Ltd</h2>
        <p style="color: #666; font-size: 12px; margin-top: 4px;">STEP AHEAD • Technical Assessment Portal</p>
      </div>

      <p>Hello <strong>${candidateName}</strong>,</p>

      <p>You have been invited by <strong>BITMAX Technology (P) Ltd</strong> to complete an official technical assessment:</p>

      <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1e293b;">${testTitle}</h3>
        <p style="margin: 0; color: #64748b; font-size: 14px;">Assessment Link Expiration: <strong>${formattedExpiry}</strong></p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" target="_blank" style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Start Assessment Now →
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b;">Or copy and paste this link in your browser:</p>
      <p style="font-size: 12px; color: #0284c7; word-break: break-all;">${inviteLink}</p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">
        © 2026 BITMAX Technology (P) Ltd. This is an automated assessment invitation.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Technical Assessment Invitation: ${testTitle} | BITMAX Technology`,
      html: htmlContent,
    });
    console.log(`Successfully sent candidate invite email to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send candidate invite email via Nodemailer:", error);
    return false;
  }
}
