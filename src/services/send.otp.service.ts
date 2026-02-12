import { createTransport } from "nodemailer";


export async function sendOtpEmail(to: string, otp: string) {
  const transporter = createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
          user: 'devante.spencer@ethereal.email',
          pass: 'SMCYsQP7hbDQ44wKkG'
      }
  });

  return transporter.sendMail({
    from: `"Verification" <devante.spencer@ethereal.email>`,
    to,
    subject: "Your verification code",
    text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
    html: `
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>It expires in 5 minutes.</p>
    `,
  });
}
