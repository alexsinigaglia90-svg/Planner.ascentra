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
  const subject = 'Reset your Planner Ascentra password'
  const html = layout(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.3px;">Reset your password</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.65;">Hi ${d.userName},</p>
    <p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.65;">
      We received a request to reset the password for your Planner Ascentra account (<strong>${d.userEmail}</strong>).
      Click the button below to choose a new password.
    </p>
    ${btn(d.resetUrl, 'Reset password')}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      This link expires in <strong>1 hour</strong>. If you didn&apos;t request a password reset, you can ignore this email &mdash; your password will not change.
    </p>
  `)
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
