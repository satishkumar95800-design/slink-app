import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/auth/session_controller.dart';
import 'package:slink/shared/models/active_user.dart';

ActiveUser _user(UserRole role, {bool hasChildren = false}) =>
    ActiveUser(id: 'u1', name: 'Saleem', role: role, tenantId: 't1', hasChildren: hasChildren);

void main() {
  test('staff with children can switch, and parent mode acts as parent', () {
    final account = _user(UserRole.accounts, hasChildren: true);
    expect(SessionState.loggedIn(account).canSwitchToParent, isTrue);
    expect(SessionState.loggedIn(account).user!.role, UserRole.accounts);

    final asParent = SessionState.loggedIn(account, actingAsParent: true);
    expect(asParent.user!.role, UserRole.parent);
    expect(asParent.account!.role, UserRole.accounts);
    expect(asParent.user!.id, 'u1');
  });

  test('no switch for staff without children or for parents', () {
    expect(SessionState.loggedIn(_user(UserRole.teacher)).canSwitchToParent, isFalse);
    expect(SessionState.loggedIn(_user(UserRole.parent, hasChildren: true)).canSwitchToParent, isFalse);
    expect(const SessionState.loggedOut().canSwitchToParent, isFalse);
  });

  test('hasChildren survives the stored round trip', () {
    final user = ActiveUser.fromJson(_user(UserRole.teacher, hasChildren: true).toJson());
    expect(user.hasChildren, isTrue);
    expect(ActiveUser.fromJson({'id': 'u1', 'name': 'A', 'role': 'teacher', 'tenantId': 't1'}).hasChildren, isFalse);
  });
}
