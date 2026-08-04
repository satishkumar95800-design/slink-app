import { ReportStatus, ReportType } from './enums';

export interface Report {
  id: string;
  tenantId: string;
  studentId: string;
  classId: string;
  teacherId: string;
  type: ReportType;
  term: string;
  academicYear: string;
  content: ReportContent;
  pdfKey: string | null;
  status: ReportStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportContent {
  subjects?: SubjectGrade[];
  attendancePercentage?: number;
  remarks?: string;
  behaviorRating?: number;
  homeworkCompletion?: number;
  teacherNotes?: string;
}

export interface SubjectGrade {
  subject: string;
  grade: string;
  marks?: number;
  maxMarks?: number;
  remarks?: string;
}

export interface CreateReportDto {
  studentIds: string[];
  type: ReportType;
  term: string;
  academicYear: string;
  content: ReportContent;
  scheduleAt?: string;
}

export interface ReadReceiptDto {
  reportId: string;
}
