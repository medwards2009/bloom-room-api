export enum UserType {
  TEACHER = 'teacher',
  ADMINISTRATOR = 'administrator',
}

export enum AuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export enum GoalType {
  YES_NO = 'yes_no',
}

export enum ReportPeriodType {
  WEEKLY = 'weekly',
  NINE_WEEK = 'nine_week',
  YEARLY = 'yearly',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  GENERATE_REPORT = 'generate_report',
}

// Class accent colour keys (shared contract with the web/mobile apps, which map
// each key to an accent + soft background from their own theme tokens). The API
// only stores/validates the key string. Stored as varchar, defaulting to `coral`.
export enum ClassColor {
  CORAL = 'coral',
  HONEY = 'honey',
  SAGE = 'sage',
  CLAY = 'clay',
  SKY = 'sky',
  PLUM = 'plum',
}
