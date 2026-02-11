import { MailtrapClient } from "mailtrap";

const client = new MailtrapClient({ token: "b4ab36df2a05c5137278d0e07512fe39" });

export async function sendOtpEmail(to: string, otp: string) {
  return client.send({
    from: { email: "hello@demomailtrap.co", name: "Mailtrap Test" },
    to: [{ email: to }],
    template_uuid: "02d66881-4fb6-46ed-ab9a-7822c7e5c042",
    template_variables: {
      "otp": otp,
      "company_info_name": "Test_Company_info_name",
      "company_info_address": "Test_Company_info_address",
      "company_info_city": "Test_Company_info_city",
      "company_info_zip_code": "Test_Company_info_zip_code",
      "company_info_country": "Test_Company_info_country"
    }
  });
}
