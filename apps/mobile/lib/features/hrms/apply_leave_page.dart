import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'hrms_models.dart';
import 'hrms_repository.dart';
import 'leave_page.dart';

/// Leave application: type, dates, half day (single day only) and reason.
class ApplyLeavePage extends ConsumerStatefulWidget {
  const ApplyLeavePage({super.key});

  @override
  ConsumerState<ApplyLeavePage> createState() => _ApplyLeavePageState();
}

class _ApplyLeavePageState extends ConsumerState<ApplyLeavePage> {
  final _reason = TextEditingController();
  String? _typeId;
  DateTime? _from;
  DateTime? _to;
  bool _half = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  bool get _singleDay => _from != null && _to != null && ymd(_from!) == ymd(_to!);

  Future<void> _pick(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isFrom ? _from : _to) ?? _from ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 2),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _from = picked;
        if (_to == null || _to!.isBefore(picked)) _to = picked;
      } else {
        _to = picked;
      }
      if (!_singleDay) _half = false;
    });
  }

  Future<void> _submit() async {
    final l = context.l10n;
    if (_typeId == null || _from == null || _to == null) {
      setState(() => _error = l.hrmsChooseTypeAndDates);
      return;
    }
    if (_to!.isBefore(_from!)) {
      setState(() => _error = l.hrmsEndBeforeStart);
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = l.hrmsReasonRequired);
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(hrmsRepositoryProvider).apply(
            leaveTypeId: _typeId!,
            from: _from!,
            to: _to!,
            halfDay: _half && _singleDay,
            reason: _reason.text.trim(),
          );
      messenger.showSnackBar(SnackBar(content: Text(l.hrmsRequestSent)));
      navigator.pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = describeLeaveError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final types = ref.watch(leaveTypesProvider);
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.hrmsApplyLeave)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          types.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(describeLeaveError(e)),
            data: (list) => DropdownButtonFormField<String>(
              initialValue: _typeId,
              decoration: InputDecoration(labelText: l.hrmsLeaveType),
              items: [
                for (final t in list)
                  DropdownMenuItem(value: t.id, child: Text(t.isPaid ? t.name : '${t.name} (${l.hrmsUnpaidLeave})')),
              ],
              onChanged: (v) => setState(() => _typeId = v),
            ),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _DateField(label: l.hrmsFromDate, value: _from, hint: l.hrmsPickDate, onTap: () => _pick(true))),
            const SizedBox(width: 12),
            Expanded(child: _DateField(label: l.hrmsToDate, value: _to, hint: l.hrmsPickDate, onTap: () => _pick(false))),
          ]),
          if (_singleDay)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l.hrmsHalfDayToggle),
              value: _half,
              onChanged: (v) => setState(() => _half = v),
            ),
          const SizedBox(height: 8),
          TextField(
            controller: _reason,
            maxLines: 3,
            maxLength: 500,
            decoration: InputDecoration(labelText: l.hrmsReason),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _sending ? null : _submit,
            child: _sending
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(l.hrmsSubmitRequest),
          ),
        ],
      ),
    );
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final String hint;
  final DateTime? value;
  final VoidCallback onTap;

  const _DateField({required this.label, required this.hint, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, suffixIcon: const Icon(Icons.event_rounded)),
        child: Text(value == null ? hint : displayYmd(ymd(value!))),
      ),
    );
  }
}
