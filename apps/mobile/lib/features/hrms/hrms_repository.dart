import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/api_client.dart';
import 'hrms_models.dart';

/// Own-data HR endpoints (/hrms/me/*). The server resolves the employee from the
/// signed-in user; nothing here ever sends an employee id.
class HrmsRepository {
  final Dio _dio;

  HrmsRepository(this._dio);

  Future<List<Payslip>> getPayslips() async {
    final r = await _dio.get<List<dynamic>>('/hrms/me/payslips');
    return [for (final e in r.data ?? []) Payslip.fromJson(e as Map<String, dynamic>)];
  }

  /// The PDF needs the auth header, so it is fetched as bytes and written to a temp file.
  Future<String> downloadPayslipPdf(String id) async {
    final r = await _dio.get<List<int>>(
      '/hrms/me/payslips/$id/pdf',
      options: Options(responseType: ResponseType.bytes, receiveTimeout: const Duration(seconds: 30)),
    );
    final file = File('${Directory.systemTemp.path}/payslip-$id.pdf');
    await file.writeAsBytes(r.data ?? const [], flush: true);
    return file.path;
  }

  Future<List<LeaveType>> getLeaveTypes() async {
    final r = await _dio.get<List<dynamic>>('/hrms/me/leave/types');
    return [for (final e in r.data ?? []) LeaveType.fromJson(e as Map<String, dynamic>)];
  }

  Future<List<LeaveBalance>> getBalances() async {
    final r = await _dio.get<List<dynamic>>('/hrms/me/leave/balances');
    return [for (final e in r.data ?? []) LeaveBalance.fromJson(e as Map<String, dynamic>)];
  }

  Future<List<LeaveRequest>> getRequests() async {
    final r = await _dio.get<List<dynamic>>('/hrms/me/leave/requests');
    return [for (final e in r.data ?? []) LeaveRequest.fromJson(e as Map<String, dynamic>)];
  }

  Future<void> apply({
    required String leaveTypeId,
    required DateTime from,
    required DateTime to,
    required bool halfDay,
    required String reason,
  }) async {
    await _dio.post<Map<String, dynamic>>('/hrms/me/leave/requests', data: {
      'leaveTypeId': leaveTypeId,
      'fromDate': ymd(from),
      'toDate': ymd(to),
      if (halfDay) 'halfDay': true,
      'reason': reason,
    });
  }

  Future<void> cancel(String id) async {
    await _dio.post<Map<String, dynamic>>('/hrms/me/leave/requests/$id/cancel');
  }
}

final hrmsRepositoryProvider = Provider<HrmsRepository>((ref) => HrmsRepository(ref.watch(apiClientProvider)));

final payslipsProvider = FutureProvider.autoDispose<List<Payslip>>((ref) => ref.watch(hrmsRepositoryProvider).getPayslips());
final leaveTypesProvider = FutureProvider.autoDispose<List<LeaveType>>((ref) => ref.watch(hrmsRepositoryProvider).getLeaveTypes());
final leaveBalancesProvider = FutureProvider.autoDispose<List<LeaveBalance>>((ref) => ref.watch(hrmsRepositoryProvider).getBalances());
final leaveRequestsProvider = FutureProvider.autoDispose<List<LeaveRequest>>((ref) => ref.watch(hrmsRepositoryProvider).getRequests());

/// True when the API says this login has no employee record (shown as a friendly empty state).
bool isNoEmployeeRecord(Object e) {
  final ex = e is DioException ? ApiException.fromDioError(e) : (e is ApiException ? e : null);
  return ex?.code == 'NO_EMPLOYEE_RECORD';
}
