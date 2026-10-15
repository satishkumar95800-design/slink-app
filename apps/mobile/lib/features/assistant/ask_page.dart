import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/api_client.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';

/// One answer from POST /assistant/ask (docs/SPEC-ai.md 3.2): an i18n headline
/// plus typed rows, all built by the server from the child's real records.
class AssistantAnswer {
  final String headlineKey;
  final Map<String, dynamic> params;
  final List<({String key, String type})> columns;
  final List<List<dynamic>> rows;

  AssistantAnswer({required this.headlineKey, required this.params, required this.columns, required this.rows});

  factory AssistantAnswer.fromJson(Map<String, dynamic> json) {
    final headline = (json['headline'] as Map<String, dynamic>?) ?? const {};
    return AssistantAnswer(
      headlineKey: headline['key'] as String? ?? 'cant_answer',
      params: (headline['params'] as Map<String, dynamic>?) ?? const {},
      columns: [
        for (final c in (json['columns'] as List? ?? const []))
          (key: (c as Map<String, dynamic>)['key'] as String, type: c['type'] as String),
      ],
      rows: [for (final r in (json['rows'] as List? ?? const [])) List<dynamic>.from(r as List)],
    );
  }
}

class AskPage extends ConsumerStatefulWidget {
  const AskPage({super.key});

  @override
  ConsumerState<AskPage> createState() => _AskPageState();
}

class _AskPageState extends ConsumerState<AskPage> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final List<({String question, AssistantAnswer? answer, String? error})> _items = [];
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _ask(String question) async {
    final q = question.trim();
    if (q.length < 2 || _busy) return;
    _controller.clear();
    setState(() {
      _busy = true;
      _items.add((question: q, answer: null, error: null));
    });
    final index = _items.length - 1;
    try {
      final res = await ref
          .read(apiClientProvider)
          .post<Map<String, dynamic>>('/assistant/ask', data: {'question': q});
      final answer = AssistantAnswer.fromJson(res.data ?? const {});
      if (mounted) setState(() => _items[index] = (question: q, answer: answer, error: null));
    } catch (e) {
      if (mounted) setState(() => _items[index] = (question: q, answer: null, error: describeError(e)));
    } finally {
      if (mounted) setState(() => _busy = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(_scroll.position.maxScrollExtent,
              duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final examples = [l.askExampleAttendance, l.askExampleFees, l.askExampleHomework, l.askExampleNotices];

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.askTitle)),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                children: [
                  if (_items.isEmpty) ...[
                    Text(l.askIntro, style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final ex in examples)
                          ActionChip(
                            avatar: const Icon(Icons.auto_awesome_rounded, size: 16),
                            label: Text(ex),
                            onPressed: () => _ask(ex),
                          ),
                      ],
                    ),
                  ],
                  for (final item in _items) ...[
                    Align(
                      alignment: Alignment.centerRight,
                      child: Container(
                        margin: const EdgeInsets.only(top: 12, left: 48),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.teal,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Text(item.question, style: const TextStyle(color: Colors.white)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (item.answer != null)
                      _AnswerCard(answer: item.answer!)
                    else if (item.error != null)
                      SoftCard(child: Text(item.error!, style: const TextStyle(color: AppColors.coral)))
                    else
                      SoftCard(child: Text(l.askThinking)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      maxLength: 300,
                      textInputAction: TextInputAction.send,
                      onSubmitted: _ask,
                      decoration: InputDecoration(
                        hintText: l.askPlaceholder,
                        counterText: '',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _busy ? null : () => _ask(_controller.text),
                    icon: const Icon(Icons.send_rounded),
                    tooltip: l.askSend,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(l.askFootnote, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnswerCard extends StatelessWidget {
  final AssistantAnswer answer;

  const _AnswerCard({required this.answer});

  String _date(BuildContext context, dynamic v) {
    final d = DateTime.tryParse('$v');
    return d == null ? '$v' : DateFormat('dd/MM/yyyy').format(d);
  }

  int _int(String k) => (answer.params[k] as num?)?.toInt() ?? 0;
  String _str(String k) => '${answer.params[k] ?? ''}';

  String _headline(BuildContext context, AppLocalizations l) => switch (answer.headlineKey) {
        'child_attendance' => l.askChildAttendance(
            _str('name'), _int('present'), _int('marked'), _int('pct'), _date(context, _str('from')), _date(context, _str('to'))),
        'child_fees' => _int('count') == 0
            ? l.askChildNoFees(_str('name'))
            : l.askChildFees(_str('name'), formatRupees(_int('amount'))),
        'child_homework' => l.askChildHomework(_str('name'), _int('count'), _int('days')),
        'recent_notices' => l.askRecentNotices(_int('count'), _int('days')),
        'which_child' => l.askWhichChild(_str('names')),
        _ => l.askCantAnswer,
      };

  String _cell(BuildContext context, AppLocalizations l, dynamic v, String type, String key) {
    if (v == null || '$v'.isEmpty) return '—';
    if (key == 'status') {
      return switch ('$v') {
        'absent' => l.attendanceAbsent,
        'late' => l.attendanceLate,
        'leave' => l.attendanceLeave,
        'present' => l.attendancePresent,
        _ => '$v',
      };
    }
    return switch (type) {
      'money' => formatRupees((v as num).round()),
      'date' => _date(context, v),
      'percent' => '$v%',
      _ => '$v',
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_headline(context, l), style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          if (answer.headlineKey == 'cant_answer') ...[
            const SizedBox(height: 6),
            Text(l.askCantAnswerHelp, style: theme.textTheme.bodySmall),
          ],
          for (final row in answer.rows.take(20)) ...[
            const Divider(height: 18),
            Text(
              [
                for (var i = 0; i < row.length && i < answer.columns.length; i++)
                  _cell(context, l, row[i], answer.columns[i].type, answer.columns[i].key),
              ].where((s) => s != '—').join(' · '),
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}
