export type DeliveryType = 'invite' | 'password_reset' | 'staffing_alert'
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'simulated'

// ─── Per-type template data shapes ───────────────────────────────────────────

export interface InviteTemplateData {
  userName: string
  userEmail: string
  inviteUrl: string
  orgName: string
}

export interface PasswordResetTemplateData {
  userName: string
  userEmail: string
  resetUrl: string
}

export interface StaffingAlertTemplateData {
  orgName: string
  date: string      // "YYYY-MM-DD"
  issue: string     // short description, e.g. "Understaffed: Morning shift"
  details?: string  // optional elaboration
}

export type TemplateData =
  | InviteTemplateData
  | PasswordResetTemplateData
  | StaffingAlertTemplateData

// ─── Rendered output ─────────────────────────────────────────────────────────

export interface RenderedEmail {
  subject: string
  html: string
}

// ─── Deliver call options ─────────────────────────────────────────────────────

export interface DeliverOptions {
  organizationId: string
  userId?: string
  type: DeliveryType
  recipient: string
  data: TemplateData
}
