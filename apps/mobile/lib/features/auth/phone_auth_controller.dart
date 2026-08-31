import 'dart:async';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/api_exception.dart';
import 'auth_repository.dart';
import 'session_controller.dart';

enum PhoneAuthStep { enterPhone, enterOtp }

class PhoneAuthState {
  final PhoneAuthStep step;
  final String? phoneNumber;
  final String? verificationId;
  final bool isLoading;
  final String? error;

  const PhoneAuthState({
    this.step = PhoneAuthStep.enterPhone,
    this.phoneNumber,
    this.verificationId,
    this.isLoading = false,
    this.error,
  });
}

/// Drives the two-screen phone-OTP flow. Firebase does the actual SMS
/// send/verify; once we have a Firebase ID token we exchange it for our own
/// JWT pair via POST /auth/phone/verify and hand off to [SessionController].
class PhoneAuthController extends StateNotifier<PhoneAuthState> {
  final Ref _ref;

  PhoneAuthController(this._ref) : super(const PhoneAuthState());

  Future<void> sendOtp(String phoneNumber) async {
    state = PhoneAuthState(phoneNumber: phoneNumber, isLoading: true);

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (credential) async {
          // Android SMS auto-retrieval — sign in directly, no code entry needed.
          await _signInWithCredential(credential);
        },
        verificationFailed: (e) {
          state = PhoneAuthState(
            phoneNumber: phoneNumber,
            error: e.message ?? 'Could not send verification code.',
          );
        },
        codeSent: (verificationId, resendToken) {
          state = PhoneAuthState(
            step: PhoneAuthStep.enterOtp,
            phoneNumber: phoneNumber,
            verificationId: verificationId,
          );
        },
        codeAutoRetrievalTimeout: (verificationId) {
          if (state.step == PhoneAuthStep.enterOtp) {
            state = PhoneAuthState(
              step: PhoneAuthStep.enterOtp,
              phoneNumber: state.phoneNumber,
              verificationId: verificationId,
            );
          }
        },
      );
    } catch (_) {
      state = PhoneAuthState(
        phoneNumber: phoneNumber,
        error: 'Could not send verification code. Please try again.',
      );
    }
  }

  Future<void> verifyOtp(String smsCode) async {
    final verificationId = state.verificationId;
    if (verificationId == null) return;

    state = PhoneAuthState(
      step: PhoneAuthStep.enterOtp,
      phoneNumber: state.phoneNumber,
      verificationId: verificationId,
      isLoading: true,
    );

    final credential = PhoneAuthProvider.credential(verificationId: verificationId, smsCode: smsCode);
    await _signInWithCredential(credential);
  }

  Future<void> _signInWithCredential(PhoneAuthCredential credential) async {
    try {
      final userCredential = await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await userCredential.user?.getIdToken();
      if (idToken == null) throw Exception('Could not retrieve ID token');

      final result = await _ref.read(authRepositoryProvider).verifyPhoneOtp(firebaseIdToken: idToken);
      await _ref.read(sessionControllerProvider.notifier).completeLogin(result);

      // Our own JWT is now the source of truth for API calls — no need to
      // keep a Firebase session alive alongside it.
      unawaited(FirebaseAuth.instance.signOut());

      state = const PhoneAuthState();
    } catch (e) {
      final message = switch (e) {
        ApiException() => e.message,
        DioException() => ApiException.fromDioError(e).message,
        FirebaseAuthException(code: 'invalid-verification-code') ||
        FirebaseAuthException(code: 'invalid-verification-id') =>
          'Invalid code. Please try again.',
        FirebaseAuthException(code: 'session-expired') =>
          'This code has expired. Please request a new one.',
        FirebaseAuthException(:final message?) => message,
        _ => 'Something went wrong. Please try again.',
      };
      state = PhoneAuthState(
        step: PhoneAuthStep.enterOtp,
        phoneNumber: state.phoneNumber,
        verificationId: state.verificationId,
        error: message,
      );
    }
  }

  void reset() => state = const PhoneAuthState();
}

final phoneAuthControllerProvider = StateNotifierProvider<PhoneAuthController, PhoneAuthState>((ref) {
  return PhoneAuthController(ref);
});
