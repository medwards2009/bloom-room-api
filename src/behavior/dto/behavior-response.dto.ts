import { GoalType } from '../../common/enums';

/**
 * Behavior goal as returned by the behaviors API. A plain object (not the raw
 * entity) so the relation graph never leaks into responses — the apps consume
 * exactly these fields.
 */
export interface BehaviorResponse {
  id: string;
  studentId: string;
  name: string;
  description: string | null;
  goalType: GoalType;
  createdAt: Date;
}
