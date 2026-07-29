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

  const fromName = "BITMAX Technology";
  const from = `"${fromName}" <${emailUser}>`;

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

  // 1. Plain-text version (Essential for Anti-Spam deliverability in Gmail/Outlook)
  const textContent = `Hello ${candidateName},

You have been invited by BITMAX Technology to complete an assessment:

Assessment: ${testTitle}
Expiration Date: ${formattedExpiry}

Access your assessment using the link below:
${inviteLink}

Thank you,
BITMAX Technology Team`;

  // 2. Ultra-lightweight, clean HTML email template
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.6; margin: 0; padding: 20px; background-color: #ffffff;">
  <div style="max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid #eeeeee; border-radius: 6px;">
    <h3 style="color: #0284c7; margin-top: 0;">BITMAX Technology</h3>
    <p>Hello ${candidateName},</p>
    <p>You have been invited to complete the technical assessment: <strong>${testTitle}</strong>.</p>
    
    <p style="margin: 20px 0;">
      <a href="${inviteLink}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Start Assessment</a>
    </p>

    <p style="font-size: 13px; color: #666666;">If the button does not work, copy and paste this URL into your browser:<br>
    <a href="${inviteLink}" style="color: #0284c7; word-break: break-all;">${inviteLink}</a></p>
    
    <p style="font-size: 12px; color: #888888; margin-top: 25px; border-top: 1px solid #eeeeee; padding-top: 15px;">
      This link will expire on ${formattedExpiry}.<br>
      © BITMAX Technology (P) Ltd
    </p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Assessment Invitation: ${testTitle}`,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Importance": "Normal",
      },
    });
    console.log(`Successfully sent candidate invite email to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send candidate invite email via Nodemailer:", error);
    return false;
  }
}
