import 'dart:async';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
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
      final isRegistered = await _ref.read(authRepositoryProvider).isPhoneRegistered(phoneNumber);
      if (!isRegistered) {
        state = PhoneAuthState(
          phoneNumber: phoneNumber,
          error: currentL10n.errorPhoneNotRegistered,
        );
        return;
      }
    } catch (e) {
      final message = switch (e) {
        ApiException() => e.message,
        DioException() => ApiException.fromDioError(e).message,
        _ => currentL10n.authCouldNotVerifyNumber,
      };
      state = PhoneAuthState(phoneNumber: phoneNumber, error: message);
      return;
    }

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
            error: e.message ?? currentL10n.authCouldNotSendCode,
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
        error: currentL10n.authCouldNotSendCodeRetry,
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
          currentL10n.authInvalidCode,
        FirebaseAuthException(code: 'session-expired') =>
          currentL10n.authCodeExpired,
        FirebaseAuthException(:final message?) => message,
        _ => currentL10n.errorGeneric,
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
