import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'consent_models.dart';
import 'consent_repository.dart';

final _date = DateFormat('dd/MM/yyyy', 'en');

const _approvedColor = Color(0xFF2E9E6A);
const _declinedColor = Color(0xFFC62828);
const _pendingColor = Color(0xFFE0A100);

/// Status pill for one child's answer.
Widget consentStatusPill(BuildContext context, ConsentItem item) {
  final l = context.l10n;
  return switch (item.status) {
    ConsentStatus.approved => StatusPill(label: l.consentApproved, color: _approvedColor, icon: Icons.check_circle_rounded),
    ConsentStatus.declined => StatusPill(label: l.consentDeclined, color: _declinedColor, icon: Icons.cancel_rounded),
    ConsentStatus.pending => item.open
        ? StatusPill(label: l.consentNeedsAnswer, color: _pendingColor, icon: Icons.edit_rounded)
        : StatusPill(label: l.consentClosed, color: FeatureColors.sent),
  };
}

/// Every consent form the school sent for the parent's children; unanswered ones first.
class ConsentPage extends ConsumerWidget {
  const ConsentPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(consentItemsProvider);
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.consentTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(consentItemsProvider.future),
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [LoadingBlock(height: 90), SizedBox(height: 10), LoadingBlock(height: 90)],
          ),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(consentItemsProvider),
          ),
          data: (items) {
            if (items.isEmpty) {
              return EmptyState(icon: Icons.assignment_turned_in_rounded, message: l.consentEmpty, color: FeatureColors.notices);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final item in items)
                  ListCard(
                    leading: const IconBadge(icon: Icons.assignment_rounded, color: FeatureColors.notices, size: 44),
                    title: item.event.title,
                    subtitle: [
                      l.consentForChild(item.studentName),
                      if (item.needsAnswer) l.consentSignBy(_date.format(item.deadline)) else _date.format(item.event.startDate),
                    ].join(' · '),
                    trailing: consentStatusPill(context, item),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => ConsentSignPage(item: item),
                    )),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The event, the consent wording, and the parent's signed answer for one child.
class ConsentSignPage extends ConsumerStatefulWidget {
  final ConsentItem item;

  const ConsentSignPage({super.key, required this.item});

  @override
  ConsumerState<ConsentSignPage> createState() => _ConsentSignPageState();
}

class _ConsentSignPageState extends ConsumerState<ConsentSignPage> {
  late ConsentAnswer? _answer = widget.item.response;
  late bool _editing = widget.item.open && widget.item.response == null;
  bool? _approve;
  bool _confirmed = false;
  bool _sending = false;
  final _name = TextEditingController();
  final _note = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _note.dispose();
    super.dispose();
  }

  bool get _canSend => _approve != null && _confirmed && _name.text.trim().length >= 3 && !_sending;

  Future<void> _send() async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _sending = true);
    try {
      final answer = await ref.read(consentRepositoryProvider).respond(
            formId: widget.item.formId,
            studentId: widget.item.studentId,
            approve: _approve!,
            signedName: _name.text.trim(),
            note: _note.text.trim(),
          );
      ref.invalidate(consentItemsProvider);
      setState(() {
        _answer = answer;
        _editing = false;
      });
      messenger.showSnackBar(SnackBar(content: Text(l.consentSubmitted)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(describeError(e))));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final item = widget.item;
    final e = item.event;
    final multiDay = e.endDate != e.startDate;
    final when = [
      multiDay ? '${_date.format(e.startDate)} – ${_date.format(e.endDate)}' : _date.format(e.startDate),
      if (e.startTime != null) e.endTime != null ? '${e.startTime} – ${e.endTime}' : e.startTime!,
    ].join(' · ');

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.consentTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.title, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(l.consentForChildClass(item.studentName, item.className), style: theme.textTheme.bodyMedium),
                const SizedBox(height: 12),
                _InfoRow(icon: Icons.event_rounded, text: when),
                if (e.venue != null) _InfoRow(icon: Icons.place_rounded, text: e.venue!),
                if (e.description != null) ...[
                  const SizedBox(height: 8),
                  Text(e.description!, style: theme.textTheme.bodyMedium),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionHeader(title: l.consentAgreeingTo),
          SoftCard(child: Text(item.body, style: theme.textTheme.bodyLarge)),
          const SizedBox(height: 16),
          if (_answer != null && !_editing) _Signed(answer: _answer!, item: item, onChange: () => setState(() => _editing = true)),
          if (_answer == null && !item.open)
            SoftCard(child: Text(l.consentClosedNote(_date.format(item.deadline)))),
          if (_editing && item.open) ...[
            SectionHeader(title: l.consentYourAnswer),
            Text(l.consentSignBy(_date.format(item.deadline)), style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            SegmentedButton<bool>(
              emptySelectionAllowed: true,
              showSelectedIcon: false,
              segments: [
                ButtonSegment(value: true, label: Text(l.consentAllow), icon: const Icon(Icons.check_rounded)),
                ButtonSegment(value: false, label: Text(l.consentDecline), icon: const Icon(Icons.close_rounded)),
              ],
              selected: {if (_approve != null) _approve!},
              onSelectionChanged: (s) => setState(() => _approve = s.isEmpty ? null : s.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _name,
              maxLength: 100,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              decoration: InputDecoration(labelText: l.consentSignatureLabel, helperText: l.consentSignatureHint),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _note,
              maxLength: 500,
              maxLines: 3,
              minLines: 1,
              decoration: InputDecoration(labelText: l.consentNoteLabel),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _confirmed,
              onChanged: (v) => setState(() => _confirmed = v ?? false),
              title: Text(l.consentConfirm(item.studentName)),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _canSend ? _send : null,
              icon: _sending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.draw_rounded),
              label: Text(l.consentSubmit),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: FeatureColors.notices),
            const SizedBox(width: 8),
            Expanded(child: Text(text)),
          ],
        ),
      );
}

class _Signed extends StatelessWidget {
  final ConsentAnswer answer;
  final ConsentItem item;
  final VoidCallback onChange;

  const _Signed({required this.answer, required this.item, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final approved = answer.decision == ConsentStatus.approved;
    final color = approved ? _approvedColor : _declinedColor;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(approved ? Icons.check_circle_rounded : Icons.cancel_rounded, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                approved ? l.consentApproved : l.consentDeclined,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(color: color, fontWeight: FontWeight.w700),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          Text(l.consentSignedBy(answer.signedName, DateFormat('dd/MM/yyyy HH:mm', 'en').format(answer.signedAt))),
          if (answer.note != null) ...[
            const SizedBox(height: 4),
            Text(answer.note!, style: Theme.of(context).textTheme.bodySmall),
          ],
          if (item.open) ...[
            const SizedBox(height: 8),
            Text(l.consentCanChange(_date.format(item.deadline)), style: Theme.of(context).textTheme.bodySmall),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(onPressed: onChange, child: Text(l.consentChange)),
            ),
          ],
        ],
      ),
    );
  }
}
