//Forgot password
import { createTransport } from "nodemailer";
import { MAILER_TRANSPORT_HOST, MAILER_TRANSPORT_PORT, MAILER_EMAIL, MAILER_PASSWORD } from "../config";

export async function sendOtpResetEmail(to: string, otp: string) {
const forgorPass = createTransport ({
    host: MAILER_TRANSPORT_HOST,
    port: MAILER_TRANSPORT_PORT,
    auth: {
      user: MAILER_EMAIL,
      pass: MAILER_PASSWORD,
    },
  });

return forgorPass.sendMail({
    from: `"noreply" <${MAILER_EMAIL}>`,
    to,
    subject: "Your One Time Password (OTP) from Gate Closes",
    text: `Your verification code is text: ${otp}. It expires in 5 minutes.`,
    html: `
     <head>
      <meta charset="UTF-8">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0a0a0a; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #1a1a1a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 30px rgba(0, 255, 100, 0.15); border: 1px solid #2a2a2a;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #000000 0%, #0d2818 50%, #a2ec29 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 26px; text-shadow: 0 0 20px #00ff6480;">Verification Code</h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background-color: #1a1a1a;">
                    <p style="color: #a0a0a0; font-size: 16px; margin: 0 0 30px 0;">Use this code to reset your password:</p>
                    
                    <!-- OTP Code Box -->
                    <div style="background-color: #0d0d0d; border: 2px dashed #a2ec29; border-radius: 12px; padding: 30px; margin: 20px 0; box-shadow: 0 0 20px rgba(0, 255, 100, 0.1);">
                      <p style="margin: 0; color: #a2ec29; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace; text-shadow: 0 0 10px rgba(0, 255, 100, 0.6);">${otp}</p>
                    </div>
                    
                    <p style="color: #707070; font-size: 14px; margin: 20px 0 0 0;">This code expires in <strong style="color: #00ff64;">5 minutes</strong></p>
                    
                    <!-- Security Notice -->
                    <div style="background-color: #1f1f0d; border-left: 4px solid #00ff64; padding: 16px 20px; margin-top: 30px; text-align: left; border-radius: 4px;">
                      <p style="margin: 0; color: #00cc50; font-size: 14px;">
                        <strong> Security:</strong> Never share this code. We'll never ask for it.
                      </p>
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #0d0d0d; padding: 20px; text-align: center; border-top: 1px solid #2a2a2a;">
                    <p style="margin: 0; color: #505050; font-size: 12px;">This is an automated message. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    `,
  });}