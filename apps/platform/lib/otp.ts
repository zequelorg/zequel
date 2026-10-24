import { randomInt } from 'crypto'

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function otpEmailHtml({
  code,
  purpose,
}: {
  code: string
  purpose: 'signup' | 'reset_password' | 'change_password' | 'delete_account'
}) {
  const purposeLabel =
    purpose === 'signup'
      ? 'verify your email'
      : purpose === 'reset_password'
        ? 'reset your password'
        : purpose === 'delete_account'
          ? 'confirm your account deletion'
          : 'confirm your password change'

  const digits = code.split('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zequel Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Courier New',Courier,monospace;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="460" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e5e5;">
          
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px 40px;border-bottom:1px solid #e5e5e5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;letter-spacing:6px;color:#000000;text-transform:uppercase;">ZEQUEL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px 0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#999999;">
                Verification Code
              </p>
              <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#444444;">
                Enter this code to ${purposeLabel}. It expires in 10 minutes.
              </p>
              
              <!-- OTP Code -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${digits.map((d) => `<td style="padding:0 4px;"><div style="width:44px;height:52px;border:1px solid #e5e5e5;background-color:#fafafa;text-align:center;line-height:52px;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;color:#000000;letter-spacing:0;">${d}</div></td>`).join('')}
                </tr>
              </table>

              <p style="margin:28px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#999999;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e5e5;">
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:2px;color:#999999;text-transform:uppercase;">
                Absalex Labs
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
