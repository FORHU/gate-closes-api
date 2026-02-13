import { createTransport } from "nodemailer";
import { MAILER_TRANSPORT_HOST, MAILER_TRANSPORT_PORT, MAILER_EMAIL, MAILER_PASSWORD } from "../config";

export async function sendOtpEmail(to: string, otp: string) {
  const transporter = createTransport({
    host: MAILER_TRANSPORT_HOST,
    port: MAILER_TRANSPORT_PORT,
    auth: {
      user: MAILER_EMAIL,
      pass: MAILER_PASSWORD,
    },
  });

  return transporter.sendMail({
    from: `"Verification" <${MAILER_EMAIL}>`,
    to,
    subject: "Your verification code",
    text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
    html: `
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>It expires in 5 minutes.</p>
    `,
  });
}
