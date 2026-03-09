import type {
  DeliveryType,
  RenderedEmail,
  InviteTemplateData,
  PasswordResetTemplateData,
  StaffingAlertTemplateData,
  TemplateData,
} from './types'

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:28px 40px;">
              <span style="color:#ffffff;font-size:17px;font-weight:600;letter-spacing:-0.3px;">Planner</span>
              <span style="color:#6b7280;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;margin-left:8px;">Ascentra</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Planner Ascentra &mdash; Workforce Scheduling<br/>
                This is an automated message. Please do not reply.
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

function btn(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 0;">
    <tr>
      <td style="background:#111827;border-radius:6px;">
        <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;letter-spacing:-0.1px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ─── Invite / account activation ─────────────────────────────────────────────

function renderInvite(d: InviteTemplateData): RenderedEmail {
  const subject = `You've been invited to ${d.orgName}`
  const html = layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.3px;">You've been invited</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65;">Hi ${d.userName},</p>
    <p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.65;">
      You've been invited to join <strong>${d.orgName}</strong> on Planner Ascentra.
      Click the button below to activate your account and set your password.
    </p>
    ${btn(d.inviteUrl, 'Activate account')}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      This activation link expires in <strong>7 days</strong>. If you did not expect this invitation, you can safely ignore this email.
    </p>
  `)
  return { subject, html }
}

// ─── Password reset ───────────────────────────────────────────────────────────

function renderPasswordReset(d: PasswordResetTemplateData): RenderedEmail {
  const subject = 'Reset your password — Planner Ascentra'
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
    style="background-color:#f0f2f5;min-width:100%;">
    <tr>
      <td align="center" style="padding:48px 16px 56px;">

        <!-- Card -->
        <table width="560" cellpadding="0" cellspacing="0" border="0" role="presentation"
          style="width:560px;max-width:560px;background-color:#ffffff;border-radius:10px;
                 box-shadow:0 2px 8px rgba(0,0,0,0.07),0 0 1px rgba(0,0,0,0.06);">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:#0f172a;border-radius:10px 10px 0 0;padding:28px 40px 26px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td>
                    <span style="display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                                 font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;line-height:1;">
                      Planner Ascentra
                    </span>
                    <span style="display:block;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                                 font-size:10px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">
                      Workforce Planning Platform
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Divider accent ── -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#2563eb 0%,#1d4ed8 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:44px 40px 0;">

              <!-- Title -->
              <h1 style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                         font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;line-height:1.25;">
                Reset your password
              </h1>

              <!-- Greeting -->
              <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:15px;color:#475569;line-height:1.7;">
                Hi ${d.userName},
              </p>

              <!-- Body copy -->
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:15px;color:#334155;line-height:1.75;">
                We received a request to reset the password associated with this account.
              </p>
              <p style="margin:0 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:15px;color:#334155;line-height:1.75;">
                Use the button below to choose a new password. This link is valid for one hour.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 36px;">
                <tr>
                  <td style="border-radius:7px;background-color:#1d4ed8;">
                    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                      href="${d.resetUrl}" style="height:48px;v-text-anchor:middle;width:200px;"
                      arcsize="15%" stroke="f" fillcolor="#1d4ed8">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">
                        Reset password
                      </center>
                    </v:roundrect><![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${d.resetUrl}"
                       style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                              font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;
                              border-radius:7px;letter-spacing:-0.1px;line-height:1;">
                      Reset password
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;margin:0 0 28px;">
                <tr>
                  <td style="height:1px;background-color:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Fallback link section -->
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">
                Or copy this link into your browser
              </p>
              <p style="margin:0 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:12px;color:#2563eb;word-break:break-all;line-height:1.6;">
                <a href="${d.resetUrl}" style="color:#2563eb;text-decoration:none;">${d.resetUrl}</a>
              </p>

              <!-- Security notice -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;margin:0 0 0;">
                <tr>
                  <td style="background-color:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 6px 6px 0;padding:14px 18px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                              font-size:13px;color:#475569;line-height:1.65;">
                      <strong style="color:#1e293b;">Didn&apos;t request this?</strong><br/>
                      If you didn&apos;t request a password reset, no action is needed &mdash; your password remains unchanged and this link will expire automatically.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:32px 40px 36px;">
              <!-- Footer divider -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;margin:0 0 20px;">
                <tr>
                  <td style="height:1px;background-color:#f1f5f9;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:12px;color:#94a3b8;line-height:1.6;">
                <strong style="color:#64748b;">Planner Ascentra</strong> &nbsp;&middot;&nbsp; Workforce Planning Platform
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                        font-size:12px;color:#cbd5e1;line-height:1.6;">
                This is an automated security message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`
  return { subject, html }
}

// ─── Critical staffing alert ──────────────────────────────────────────────────

function renderStaffingAlert(d: StaffingAlertTemplateData): RenderedEmail {
  const subject = `Staffing alert — ${d.date}`
  const html = layout(`
    <p style="margin:0 0 20px;">
      <span style="display:inline-block;padding:3px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em;">Critical</span>
    </p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.3px;">Staffing alert</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.65;">
      A critical staffing issue has been detected for <strong>${d.orgName}</strong> on <strong>${d.date}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border:1px solid #fee2e2;border-radius:6px;background:#fff7f7;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${d.issue}</p>
          ${d.details ? `<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${d.details}</p>` : ''}
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Log in to Planner Ascentra to review and resolve the staffing schedule.
    </p>
  `)
  return { subject, html }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function renderTemplate(type: DeliveryType, data: TemplateData): RenderedEmail {
  switch (type) {
    case 'invite':
      return renderInvite(data as InviteTemplateData)
    case 'password_reset':
      return renderPasswordReset(data as PasswordResetTemplateData)
    case 'staffing_alert':
      return renderStaffingAlert(data as StaffingAlertTemplateData)
  }
}
