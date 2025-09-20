// Bill status validation utilities
export type BillStatus = 'pending' | 'paid' | 'overdue';

export interface StatusTransition {
  from: BillStatus;
  to: BillStatus;
  isValid: boolean;
  reason?: string;
}

// Define valid status transitions
const VALID_TRANSITIONS: Record<BillStatus, BillStatus[]> = {
  pending: ['paid', 'overdue'],
  overdue: ['paid'],
  paid: [] // Paid bills cannot be changed to other statuses
};

/**
 * Validates if a status transition is allowed
 */
export function validateStatusTransition(currentStatus: BillStatus, newStatus: BillStatus): StatusTransition {
  const transition: StatusTransition = {
    from: currentStatus,
    to: newStatus,
    isValid: false
  };

  // Allow same status (no change)
  if (currentStatus === newStatus) {
    transition.isValid = true;
    return transition;
  }

  // Check if transition is in allowed list
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  
  if (allowedTransitions.includes(newStatus)) {
    transition.isValid = true;
  } else {
    transition.reason = `Cannot change status from "${currentStatus}" to "${newStatus}"`;
  }

  return transition;
}

/**
 * Get user-friendly status labels
 */
export function getStatusLabel(status: BillStatus): string {
  const labels: Record<BillStatus, string> = {
    pending: 'Pendente',
    paid: 'Paga',
    overdue: 'Vencida'
  };
  
  return labels[status] || status;
}