import { PaymentMethod } from './enums';

export interface Receipt {
  id: string;
  tenantId: string;
  receiptNumber: string;
  studentFeeId: string;
  studentId: string;
  classId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidOn: Date;
  notes: string | null;
  recordedBy: string | null;
  paymentOrderId: string | null;
  createdAt: Date;
}
