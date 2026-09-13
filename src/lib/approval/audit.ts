import type { ApprovalAuditEvent } from "../runtime/types";
import { getApprovalAuditRepository } from "./audit-repository";

export function recordApprovalAuditEvent(
  event: Omit<ApprovalAuditEvent, "id" | "timestamp">
): ApprovalAuditEvent {
  const fullEvent: ApprovalAuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  getApprovalAuditRepository().create(fullEvent);
  return fullEvent;
}

export function getApprovalAuditEvents(
  business_id: string,
  limit = 100
): ApprovalAuditEvent[] {
  return getApprovalAuditRepository().getByBusiness(business_id, limit);
}

export function clearApprovalAuditEvents(): void {
  getApprovalAuditRepository().clearCache();
}
