import { FeeStatus, PaymentGateway, PaymentOrderStatus } from './enums';

export interface FeeStructure {
  id: string;
  tenantId: string;
  classId: string;
  name: string;
  totalAmount: number;
  dueDate: Date;
  lateFeePerDay: number;
  academicYear: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeItem {
  id: string;
  feeStructureId: string;
  label: string;
  amount: number;
}

export interface StudentFee {
  id: string;
  tenantId: string;
  studentId: string;
  feeStructureId: string;
  amountDue: number;
  amountPaid: number;
  status: FeeStatus;
  dueDate: Date;
}

export interface PaymentOrder {
  id: string;
  tenantId: string;
  studentFeeId: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  idempotencyKey: string;
  createdAt: Date;
}

export interface PaymentTransaction {
  id: string;
  tenantId: string;
  paymentOrderId: string;
  gatewayPaymentId: string;
  amount: number;
  paidAt: Date;
  receiptUrl: string | null;
}

export interface CreatePaymentOrderDto {
  studentFeeId: string;
  amount: number;
  gateway?: PaymentGateway;
}

export interface VerifyPaymentDto {
  orderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}
