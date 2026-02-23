/**
 * Email Service
 *
 * Handles all outbound email notifications via SMTP (nodemailer).
 * Every send function is fire-and-catch — email failures never break API responses.
 */
import transport from "../config/email.config.js";
import config from "../config/env.config.js";
import { logError, logInfo } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const FROM = `Expensly <${config.emailConfig.user}>`;

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 13px; }
    .body { padding: 36px 40px; }
    .body h2 { margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #1e293b; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #475569; }
    .otp-box { background: #f1f5f9; border: 2px dashed #2563eb; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-box span { font-size: 40px; font-weight: 800; color: #2563eb; letter-spacing: 12px; font-family: monospace; }
    .info-card { background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
    .info-card .label { font-size: 12px; text-transform: uppercase; font-weight: 600; color: #94a3b8; margin-bottom: 4px; }
    .info-card .value { font-size: 15px; font-weight: 600; color: #1e293b; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-approved { background: #dcfce7; color: #166534; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #fef9c3; color: #854d0e; }
    .badge-info { background: #dbeafe; color: #1e40af; }
    .btn { display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>💸 Expensly</h1>
      <p>Smart Expense Management</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>This is an automated message from Expensly. Please do not reply to this email.<br />
      © ${new Date().getFullYear()} Expensly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

async function send(
  to: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
): Promise<void> {
  try {
    await transport.sendMail({ from: FROM, to, subject, html, attachments });
    logInfo(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logError(err, {
      message: `Failed to send email to ${to}`,
      code: "EMAIL_SEND_ERROR",
      subject,
    });
  }
}

// ---------------------------------------------------------------------------
// OTP Email
// ---------------------------------------------------------------------------
export async function sendOtpEmail(
  to: string,
  name: string,
  otp: string,
  expiresInMinutes: number,
): Promise<void> {
  const html = baseTemplate(
    "Your Expensly Login OTP",
    `<h2>Hello, ${name} 👋</h2>
    <p>You requested a one-time password to sign in to your Expensly account. Use the code below — it expires in <strong>${expiresInMinutes} minute${expiresInMinutes !== 1 ? "s" : ""}</strong>.</p>
    <div class="otp-box">
      <div style="font-size: 12px; text-transform: uppercase; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Your One-Time Password</div>
      <span>${otp}</span>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">⚠️ Never share this code with anyone. Expensly staff will never ask for your OTP. If you didn't request this, please ignore this email — your account remains secure.</p>`,
  );
  await send(to, "Your Expensly Login OTP", html);
}

// ---------------------------------------------------------------------------
// Password Reset OTP Email
// ---------------------------------------------------------------------------
export async function sendPasswordResetOtpEmail(
  to: string,
  name: string,
  otp: string,
  expiresInMinutes: number,
): Promise<void> {
  const html = baseTemplate(
    "Reset Your Expensly Password",
    `<h2>Password Reset Request 🔐</h2>
    <p>Hi <strong>${name}</strong>, we received a request to reset your Expensly account password. Use the code below — it expires in <strong>${expiresInMinutes} minute${expiresInMinutes !== 1 ? "s" : ""}</strong>.</p>
    <div class="otp-box">
      <div style="font-size: 12px; text-transform: uppercase; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Password Reset OTP</div>
      <span>${otp}</span>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">⚠️ If you did not request a password reset, please ignore this email — your account remains secure and your password has not been changed.</p>`,
  );
  await send(to, "Reset Your Expensly Password", html);
}

// ---------------------------------------------------------------------------
// Ticket submitted — notify manager / admin
// ---------------------------------------------------------------------------
export async function sendTicketSubmittedEmail(
  to: string,
  recipientName: string,
  submitterName: string,
  ticketTitle: string,
  amount: number,
  currency: string,
): Promise<void> {
  const html = baseTemplate(
    "New Expense Ticket Submitted",
    `<h2>New Expense Ticket 📋</h2>
    <p>Hi <strong>${recipientName}</strong>, a new expense ticket has been submitted and is awaiting your review.</p>
    <div class="info-card">
      <div class="label">Submitted by</div>
      <div class="value">${submitterName}</div>
    </div>
    <div class="info-card">
      <div class="label">Ticket</div>
      <div class="value">${ticketTitle}</div>
    </div>
    <div class="info-card">
      <div class="label">Amount</div>
      <div class="value">${amount.toFixed(2)} ${currency}</div>
    </div>
    <div class="divider"></div>
    <p>Please log in to Expensly to review and take action on this ticket.</p>`,
  );
  await send(to, `New Expense Ticket: ${ticketTitle}`, html);
}

// ---------------------------------------------------------------------------
// Ticket status change — notify submitter
// ---------------------------------------------------------------------------
export async function sendTicketStatusEmail(
  to: string,
  userName: string,
  ticketTitle: string,
  newStatus: string,
  comments?: string | null,
): Promise<void> {
  const isApproved = newStatus.toLowerCase() === "approved";
  const isRejected = newStatus.toLowerCase() === "rejected";
  const badge = isApproved
    ? `<span class="badge badge-approved">Approved ✓</span>`
    : isRejected
      ? `<span class="badge badge-rejected">Rejected ✗</span>`
      : `<span class="badge badge-pending">${newStatus}</span>`;

  const html = baseTemplate(
    `Expense Ticket ${isApproved ? "Approved" : isRejected ? "Rejected" : "Updated"}`,
    `<h2>Ticket Status Update</h2>
    <p>Hi <strong>${userName}</strong>, your expense ticket status has been updated.</p>
    <div class="info-card">
      <div class="label">Ticket</div>
      <div class="value">${ticketTitle}</div>
    </div>
    <div class="info-card">
      <div class="label">New Status</div>
      <div class="value">${badge}</div>
    </div>
    ${
      comments
        ? `<div class="info-card">
      <div class="label">Reviewer Comments</div>
      <div class="value">${comments}</div>
    </div>`
        : ""
    }
    <div class="divider"></div>
    <p>${
      isApproved
        ? "🎉 Great news! Your expense has been approved and will be processed shortly."
        : isRejected
          ? "Your expense ticket was not approved. Please review the comments above and contact your manager if you have questions."
          : "Your ticket has been updated. Please log in to Expensly for more details."
    }</p>`,
  );

  const subject = isApproved
    ? `✅ Approved: ${ticketTitle}`
    : isRejected
      ? `❌ Rejected: ${ticketTitle}`
      : `Ticket Updated: ${ticketTitle}`;

  await send(to, subject, html);
}

// ---------------------------------------------------------------------------
// Signup approved — notify org admin
// ---------------------------------------------------------------------------
export async function sendSignupApprovedEmail(
  to: string,
  adminName: string,
  orgName: string,
): Promise<void> {
  const html = baseTemplate(
    "Your Organization Has Been Approved",
    `<h2>Welcome to Expensly! 🎉</h2>
    <p>Hi <strong>${adminName}</strong>, great news! Your organization <strong>${orgName}</strong> has been approved and your account is now active.</p>
    <div class="info-card">
      <div class="label">Organization</div>
      <div class="value">${orgName}</div>
    </div>
    <div class="info-card">
      <div class="label">Status</div>
      <div class="value"><span class="badge badge-approved">Active ✓</span></div>
    </div>
    <div class="divider"></div>
    <p>You can now log in to your Expensly admin dashboard to manage your team, departments, and expenses.</p>`,
  );
  await send(to, `✅ Your organization "${orgName}" is approved!`, html);
}

// ---------------------------------------------------------------------------
// Signup rejected / org disabled — notify org admin
// ---------------------------------------------------------------------------
export async function sendSignupRejectedEmail(
  to: string,
  adminName: string,
  orgName: string,
): Promise<void> {
  const html = baseTemplate(
    "Organization Access Disabled",
    `<h2>Account Status Update</h2>
    <p>Hi <strong>${adminName}</strong>, your organization <strong>${orgName}</strong> has been disabled on Expensly.</p>
    <div class="info-card">
      <div class="label">Organization</div>
      <div class="value">${orgName}</div>
    </div>
    <div class="info-card">
      <div class="label">Status</div>
      <div class="value"><span class="badge badge-rejected">Disabled</span></div>
    </div>
    <div class="divider"></div>
    <p>If you believe this is a mistake, please contact Expensly support.</p>`,
  );
  await send(to, `Organization "${orgName}" has been disabled`, html);
}

// ---------------------------------------------------------------------------
// Report email — send generated CSV report to user
// ---------------------------------------------------------------------------
export async function sendReportEmail(
  to: string,
  name: string,
  filename: string,
  csvBuffer: Buffer,
  downloadUrl: string,
): Promise<void> {
  const html = baseTemplate(
    "Your Expensly Expense Report",
    `<h2>Your Report is Ready 📊</h2>
    <p>Hi <strong>${name}</strong>, your expense report has been generated and is attached to this email.</p>
    <div class="info-card">
      <div class="label">File</div>
      <div class="value">${filename}</div>
    </div>
    <div class="divider"></div>
    <p>You can also download the report directly using the button below. This link is valid for <strong>7 days</strong>.</p>
    <a href="${downloadUrl}" class="btn" target="_blank">⬇️ Download Report</a>
    <p style="font-size: 13px; color: #94a3b8;">If the button doesn't work, copy and paste this URL into your browser:<br/><span style="word-break: break-all; font-family: monospace; font-size: 12px;">${downloadUrl}</span></p>`,
  );
  await send(
    to,
    `Your Expensly Report — ${filename}`,
    html,
    [{ filename, content: csvBuffer, contentType: 'text/csv' }],
  );
}

// ---------------------------------------------------------------------------
// Welcome email — new user added to org
// ---------------------------------------------------------------------------
export async function sendWelcomeEmail(
  to: string,
  userName: string,
  orgName: string,
  tempPassword?: string,
): Promise<void> {
  const html = baseTemplate(
    "Welcome to Expensly",
    `<h2>Welcome to Expensly, ${userName}! 🚀</h2>
    <p>You've been added to <strong>${orgName}</strong>'s Expensly workspace. You can now log in and start submitting expense tickets.</p>
    ${
      tempPassword
        ? `<div class="info-card">
      <div class="label">Temporary Password</div>
      <div class="value" style="font-family: monospace;">${tempPassword}</div>
    </div>
    <p style="font-size: 13px; color: #ef4444;">⚠️ Please change your password after your first login.</p>`
        : ""
    }
    <div class="divider"></div>
    <p>If you have any questions, reach out to your organization admin.</p>`,
  );
  await send(to, `Welcome to Expensly — ${orgName}`, html);
}
