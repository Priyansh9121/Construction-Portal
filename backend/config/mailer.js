/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Everything the backend needs to send transactional email: the SMTP
| transport, a startup health check, a generic send function, and the two
| messages this product actually sends.
|
| Responsibilities:
|   - Decide whether real SMTP is available, and behave sensibly when not
|   - Build and cache one nodemailer transport, lazily
|   - Provide the shared HTML shell and button used by both templates
|   - Send the password-reset and account-invite messages
|
| Exports:
|   isConfigured              boolean, evaluated once at require time
|   checkMailConnection()     startup probe; throws in production
|   sendMail()                the generic sender
|   sendPasswordResetEmail()  forgot-password flow
|   sendAccountInviteEmail()  admin-created accounts
|
| Used by:
|   backend/server.js — calls checkMailConnection() during startup
|   backend/modules/auth/auth.service.js — sends the reset email
|   backend/modules/companies/company.controller.js — invites new users
|
| Depends on:
|   nodemailer
|   config/env.js for every SMTP_*, MAIL_* and URL value
|
| Database tables touched:
|   none. The reset token is generated and stored by auth.service.js; this
|   module only puts it in a link.
|
| Frontend surface:
|   both templates link to /reset-password on the frontend, which is
|   frontend/src/pages/ResetPasswordPage.jsx. That page posts the token back
|   to POST /api/auth/reset-password.
|
| Security:
|   - No message here ever contains a password. The invite flow deliberately
|     reuses the reset token so a plaintext password never exists.
|   - sendMail resolves rather than throws on failure, so a mail outage
|     cannot be turned into an oracle for which addresses are registered.
|   - The reset token appears in a URL. That is normal for this flow, but it
|     is why the token is single-use and short-lived — see
|     RESET_TOKEN_TTL_MINUTES in config/env.js.
|
| Environment:
|   Without SMTP_HOST, SMTP_USER and SMTP_PASSWORD this module logs messages
|   to the console instead of sending them. Convenient locally; fatal at
|   startup in production, by design.
|
*/

const nodemailer = require("nodemailer");

const {
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

/*
 * Whether a real SMTP transport can be built.
 *
 * All three parts are needed — a host with no credentials would be
 * accepted by nodemailer and then rejected by the server at send time.
 *
 * When false, sendPasswordResetEmail logs the link to the console instead,
 * so password reset can still be exercised locally. In production the
 * startup check refuses to boot rather than leaving users unable to
 * recover an account.
 */
const isConfigured = Boolean(
  SMTP_HOST && SMTP_USER && SMTP_PASSWORD
);

let transporter = null;

/**
 * Builds the transport on first use.
 *
 * Lazy so local development without SMTP still boots.
 *
 * Parameters:
 * none
 *
 * Returns:
 * The cached nodemailer transport, or null when SMTP is not configured.
 * Callers must handle the null — sendMail treats it as "log instead".
 *
 * Side effects:
 * Creates and memoises the transport on the first successful call. No
 * network traffic happens here; nodemailer connects on the first send.
 *
 * Performance:
 * Caching matters because a transport holds a connection pool. Building one
 * per message would open a new TCP and TLS session every time.
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
 *
 * Parameters:
 * none
 *
 * Returns:
 * { configured: true, host } when SMTP is reachable, or
 * { configured: false, message } in development without SMTP.
 *
 * Throws:
 * In production when SMTP is absent, and in any environment when verify()
 * fails — bad credentials, unreachable host, TLS mismatch. server.js lets
 * that abort the boot.
 *
 * Side effects:
 * Opens a connection to the SMTP server and authenticates, via
 * nodemailer's verify().
 *
 * Business rule:
 * The environment split is the whole point. Locally, missing SMTP is a
 * normal state and the server should start. In production a password reset
 * that silently goes nowhere locks users out with no signal to anyone, so
 * failing to boot is the safer outcome.
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
 *
 * Parameters (one options object):
 * to      - recipient address
 * subject - subject line
 * text    - plain-text body; required, and not merely a courtesy. Spam
 *           filters score HTML-only mail badly, and it is the part logged
 *           when SMTP is absent.
 * html    - HTML body
 *
 * Returns:
 * { sent: true, messageId }        delivered to the SMTP server
 * { sent: false, logged: true }    no SMTP; written to the console
 * { sent: false, error }           the send was attempted and failed
 *
 * Side effects:
 * Network I/O to the SMTP server, or a console write in the fallback case.
 *
 * Error handling:
 * Never throws. Every failure is reported through the return value, which
 * is what lets callers stay silent about delivery problems.
 *
 * Security:
 * The console fallback prints the whole message, reset link included. That
 * is intentional for local development and is another reason production
 * refuses to start without SMTP — a reset token in a production log is not
 * something anyone wants.
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

/**
 * Wraps body HTML in the shared email shell.
 *
 * Written the way email HTML has to be written rather than the way a web
 * page would be: nested tables for layout, and every style inline. Email
 * clients — Outlook especially — ignore <style> blocks and have patchy
 * support for flexbox and grid, so a stylesheet would simply not apply.
 *
 * role="presentation" tells a screen reader these tables are scaffolding
 * rather than data, so it does not announce rows and columns.
 *
 * `title` and `bodyHtml` are interpolated unescaped. Both are supplied by
 * this module, never by a user, so there is no injection path — but that
 * is a property of the call sites, not of this function.
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

/**
 * A call-to-action button, with the raw URL repeated beneath it.
 *
 * The plain link matters: many clients strip or rewrite anchors, and some
 * users read mail where buttons do not render at all. Showing the URL means
 * the message still works when the button does not.
 *
 * word-break:break-all stops a long signed token from stretching the
 * message past the viewport on a phone.
 */
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
 *
 * Parameters (one options object):
 * to               - recipient address
 * fullName         - used in the greeting; optional, falls back to "Hello,"
 * token            - the reset token generated by auth.service.js
 * expiresInMinutes - stated in the message; defaults to 60. Cosmetic only —
 *                    the real expiry is the stored reset_token_expires, so
 *                    a caller passing a figure that disagrees with
 *                    RESET_TOKEN_TTL_MINUTES would mislead the user without
 *                    changing when the token actually dies.
 *
 * Returns:
 * The sendMail result. Callers are expected to ignore a failure.
 *
 * Side effects:
 * Sends one email.
 *
 * Security:
 * The token is URL-encoded before interpolation, so a token containing a
 * URL-significant character cannot truncate the link. The wording avoids
 * confirming that an account exists, matching the deliberately vague
 * response the forgot-password endpoint gives.
 */
const sendPasswordResetEmail = ({
  to,
  fullName,
  token,
  expiresInMinutes = 60,
}) => {
  /*
   * The link must point at the frontend, not the API. FRONTEND_URL is the
   * correct answer; BASE_URL is a fallback for deployments where the two
   * are the same origin, and the localhost default keeps the flow usable
   * with nothing configured at all.
   */
  const base =
    FRONTEND_URL ||
    BASE_URL ||
    "http://localhost:5173";

  // Strip a trailing slash before appending, or a FRONTEND_URL ending in
  // "/" would produce a double slash in the path.
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
 *
 * Parameters (one options object):
 * to          - the new user's address
 * fullName    - optional; omitted from the greeting if absent
 * companyName - optional; falls back to "Construction Portal"
 * token       - a reset token, generated the same way as for a forgotten
 *               password
 *
 * Returns:
 * The sendMail result.
 *
 * Side effects:
 * Sends one email.
 *
 * Business rule:
 * An administrator creating an account never sets a password. The invite
 * carries a reset token instead, so the first password the account ever has
 * is one only its owner has seen. That removes the whole category of
 * temporary passwords being emailed, reused, or left unchanged.
 *
 * Security:
 * fullName and companyName are interpolated into the HTML without escaping.
 * Both originate from user-supplied records, so a name containing markup
 * would be rendered as markup in the recipient's mail client. Recorded as
 * F-07 in docs/repository-reference/findings.md.
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
