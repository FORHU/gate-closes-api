import { createTransport } from "nodemailer";
import * as path from "path";
import { MAILER_TRANSPORT_HOST, MAILER_TRANSPORT_PORT, MAILER_EMAIL, MAILER_PASSWORD } from "../config";

export type OtpPurpose = "email_verify" | "reset_password";

const OTP_CONFIG: Record<OtpPurpose, { subject: string; headline: string; subtext: string; preheader: string }> = {
  email_verify: {
    subject: "Verify Your Email - Gate Closes",
    headline: "Verify Your Email Address",
    subtext: "Use this code to verify your account. This code is valid for the next",
    preheader: "Your one-time verification code is ready. It expires in 5 minutes.",
  },
  reset_password: {
    subject: "Reset Your Password - Gate Closes",
    headline: "Reset Your Password",
    subtext: "Use this code to reset your password. This code is valid for the next",
    preheader: "Your one-time reset code is ready. It expires in 5 minutes.",
  },
};

export async function sendOtpEmail(to: string, otp: string, purpose: OtpPurpose) {
  const config = OTP_CONFIG[purpose];
  const transporter = createTransport({
    host: MAILER_TRANSPORT_HOST,
    port: MAILER_TRANSPORT_PORT,
    auth: {
      user: MAILER_EMAIL,
      pass: MAILER_PASSWORD,
    },
  });
    // Resolve PNG paths relative to the compiled file.
    // Works in dev (src/) and prod (dist/) because we copy assets next to the JS.
    const logoIconPath = path.join(__dirname, "../assets/gate-closes-logo.png");
    const logoTextPath = path.join(__dirname, "../assets/gate-closes-text.png");

  return transporter.sendMail({
    from: `"noreply" <${MAILER_EMAIL}>`,
    to,
    subject: config.subject,
    text: `Your code is: ${otp}. It expires in 5 minutes.`,
    html: `<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OTP Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#f8f8f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <!-- Preheader text (hidden in inbox preview) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    ${config.preheader}
  </div>

  <!-- Outer Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8f8f7; padding: 40px 20px;">
    <tr>
      <td align="center">

        <!-- Email Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color:#ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header with PNG Logo -->
          <tr>
            <td style="background-color:#000000; padding: 32px 40px; text-align:center;">
             <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
            <img src="cid:logo-icon-png" alt="Gate Closes Logo" style="display:block; width: 64px; height: auto; border: 0;">
            </td>
              <td style="vertical-align: middle;">
                <img src="cid:logo-text-png" alt="Gate Closes Text" style="display:block; width: 220px; height: auto; border: 0;">
              </td>
          </tr>
        </table>
       </td>

          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding: 24px 40px 32px 40px;">
              <!-- Greeting -->
              <h1 style="margin: 0 0 16px 0; font-size: 26px; font-weight: 700; color: #000000; line-height: 1.3; text-align:center;">
                ${config.headline}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color:#333333;">
                Hi there <br/>
                ${config.subtext} <strong style="color:#000000;">5 minutes</strong>.
              </p>

              <!-- OTP Code Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="background-color:#f8f8f7; border: 2px dashed #bbe40a; border-radius: 12px; padding: 28px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color:#000000; text-transform: uppercase; letter-spacing: 2px;">
                      Your Verification Code
                    </p>
                    <div style="font-size: 42px; font-weight: 800; color:#000000; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 8px 0;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #f8f8f7; border-left: 4px solid #bbe40a; padding: 16px 20px; margin-top: 30px; text-align: left; border-radius: 4px;">
                <p style="margin: 0; color: #000000; font-size: 14px;">
                  <strong> Security:</strong> Never share this code. We'll never ask for it.
                </p>
              </div>

              <!-- Warning Text -->
              <p style="margin: 24px 0; font-size: 14px; line-height: 1.6; color:#666666;">
                  If you didn't request this code, you can safely ignore this email. Someone might have entered your email by mistake.
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background-color:#e5e5e5; font-size:0; line-height:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; text-align:center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color:#666666;">
                Need help? Contact us at
                <a href="mailto:support@gatecloses.com" style="color:#000000; text-decoration: none; font-weight: 600;">support@gatecloses.com</a>
              </p>
              <p style="margin: 16px 0 8px 0; font-size: 12px; color:#999999;">
                © 2026 GateCloses. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

        <!-- Outer Footer Note -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">
          <tr>
            <td align="center" style="padding: 24px 20px;">
              <p style="margin: 0; font-size: 11px; color:#999999; line-height: 1.5;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`,attachments: [
      {
        filename: "gate-closes-logo.png",   // ← was "logo-icon.png"
        path: logoIconPath,
        cid: "logo-icon-png",
      },
      {
        filename: "gate-closes-text.png",   // ← was "logo-text.png"
        path: logoTextPath,
        cid: "logo-text-png",
      },
    ],
  });
}
