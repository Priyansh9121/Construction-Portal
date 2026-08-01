const nodemailer = require("nodemailer");

const {
  NODE_ENV,
  IS_PRODUCTION,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  MAIL_FROM,
  MAIL_FROM_NAME,
  BASE_URL,
  FRONTEND_URL,
} = require("./env");

/*
|--------------------------------------------------------------------------
| Transactional email
|--------------------------------------------------------------------------
|
| Before this existed, forgotPassword generated and stored a reset token
| correctly but only returned the raw token when NODE_ENV was development.
| In production a user who forgot their password had no recovery path at
| all — the token was created and then discarded.
|
| Any SMTP provider works: Gmail app password, Resend, SendGrid, Postmark,
| Amazon SES. Configure it with the SMTP_* variables in .env.
|
| When SMTP is not configured:
|
|   development  the message is logged to the console, so the reset link is
|                still usable while working locally.
|   production   startup fails loudly rather than silently dropping mail —
|                a password reset that goes nowhere is worse than one that
|                refuses to start.
|
*/

const isConfigured = Boolean(
  SMTP_HOST && SMTP_USER && SMTP_PASSWORD
);

let transporter = null;

/**
 * Builds the transport on first use.
 *
 * Lazy so local development without SMTP still boots.
 */
const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!isConfigured) {
    return null;
  }

  transporter =
    nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // Implicit TLS on 465; STARTTLS on 587.
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      // Fail fast rather than holding a request open.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

  return transporter;
};

/**
 * Confirms the mail provider is reachable.
 *
 * Called at startup so a broken configuration surfaces immediately rather
 * than the first time a user asks for a reset.
 */
const checkMailConnection = async () => {
  if (!isConfigured) {
    if (IS_PRODUCTION) {
      throw new Error(
        "SMTP is not configured. Password reset cannot work in production without it. " +
          "Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
      );
    }

    return {
      configured: false,
      message:
        "SMTP not configured — emails will be logged to the console.",
    };
  }

  await getTransporter().verify();

  return {
    configured: true,
    host: SMTP_HOST,
  };
};

/**
 * Sends one message.
 *
 * Returns { sent: boolean }. Callers decide whether a failure should be
 * surfaced; password reset deliberately does not, so a mail outage cannot
 * be used to probe which email addresses exist.
 */
const sendMail = async ({
  to,
  subject,
  text,
  html,
}) => {
  const transport = getTransporter();

  if (!transport) {
    // Development fallback: the reset link is still usable from the log.
    console.info(
      "\n=== EMAIL (not sent — SMTP not configured) ===\n" +
        `To:      ${to}\n` +
        `Subject: ${subject}\n\n` +
        `${text}\n` +
        "=============================================\n"
    );

    return {
      sent: false,
      logged: true,
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"${MAIL_FROM_NAME}" <${MAIL_FROM}>`,
      to,
      subject,
      text,
      html,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error(
      "[mailer] send failed:",
      {
        to,
        subject,
        message: error.message,
      }
    );

    return {
      sent: false,
      error: error.message,
    };
  }
};

/*
|--------------------------------------------------------------------------
| Templates
|--------------------------------------------------------------------------
|
| Plain inline HTML with a text alternative. No external assets, because
| mail clients block them and the text part is what most filters read.
|
*/

const layout = (
  title,
  bodyHtml
) => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2430;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;padding:32px;">
          <tr><td>
            <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
            ${bodyHtml}
            <hr style="border:none;border-top:1px solid #e6e8ec;margin:28px 0 16px;" />
            <p style="margin:0;font-size:12px;color:#6b7280;">
              ${MAIL_FROM_NAME}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
`;

const button = (url, label) => `
  <p style="margin:24px 0;">
    <a href="${url}"
       style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600;">
      ${label}
    </a>
  </p>
  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
    If the button does not work, paste this into your browser:
  </p>
  <p style="margin:0;font-size:13px;word-break:break-all;color:#2563eb;">
    ${url}
  </p>
`;

/**
 * Password reset.
 *
 * The link points at the frontend, which posts the token back to
 * /api/auth/reset-password.
 */
const sendPasswordResetEmail = ({
  to,
  fullName,
  token,
  expiresInMinutes = 60,
}) => {
  const base =
    FRONTEND_URL ||
    BASE_URL ||
    "http://localhost:5173";

  const url = `${base.replace(
    /\/$/,
    ""
  )}/reset-password?token=${encodeURIComponent(
    token
  )}`;

  const greeting = fullName
    ? `Hello ${fullName},`
    : "Hello,";

  const text = [
    greeting,
    "",
    "We received a request to reset your Construction Portal password.",
    "",
    `Open this link to choose a new one (valid for ${expiresInMinutes} minutes):`,
    url,
    "",
    "If you did not request this, you can ignore this email — your password will not change.",
  ].join("\n");

  return sendMail({
    to,
    subject: "Reset your Construction Portal password",
    text,
    html: layout(
      "Reset your password",
      `
        <p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0;">
          We received a request to reset your Construction Portal password.
          This link is valid for ${expiresInMinutes} minutes.
        </p>
        ${button(url, "Choose a new password")}
        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
          If you did not request this, ignore this email — your password will not change.
        </p>
      `
    ),
  });
};

/**
 * Welcome mail for an account created by an administrator.
 *
 * Reuses the reset flow so the office never has to know or transmit a
 * password.
 */
const sendAccountInviteEmail = ({
  to,
  fullName,
  companyName,
  token,
}) => {
  const base =
    FRONTEND_URL ||
    BASE_URL ||
    "http://localhost:5173";

  const url = `${base.replace(
    /\/$/,
    ""
  )}/reset-password?token=${encodeURIComponent(
    token
  )}`;

  const text = [
    `Hello ${fullName || ""},`.trim(),
    "",
    `An account has been created for you on ${
      companyName || "Construction Portal"
    }.`,
    "",
    "Set your password to get started:",
    url,
  ].join("\n");

  return sendMail({
    to,
    subject: `Your ${
      companyName || "Construction Portal"
    } account`,
    text,
    html: layout(
      "Welcome",
      `
        <p style="margin:0 0 12px;">Hello ${
          fullName || ""
        },</p>
        <p style="margin:0;">
          An account has been created for you on
          <strong>${
            companyName ||
            "Construction Portal"
          }</strong>.
        </p>
        ${button(url, "Set your password")}
      `
    ),
  });
};

module.exports = {
  isConfigured,
  checkMailConnection,
  sendMail,
  sendPasswordResetEmail,
  sendAccountInviteEmail,
};
