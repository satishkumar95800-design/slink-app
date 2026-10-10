import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/api_exception.dart';
import '../fees/fee_labels.dart';
import '../home/parent_home_models.dart';
import '../../shared/services/files_repository.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../home/parent_home_repository.dart';
import 'my_payment_claims_page.dart';
import 'payment_claims_repository.dart';

const _paymentModes = ['cash', 'cheque', 'bank_transfer', 'upi'];

/// Lets a parent tell the school "I already paid this outside the app" by
/// attaching proof (photo/screenshot) — POST /files/upload followed by
/// POST /payment-claims. The claim sits pending until an accountant/admin
/// reviews it; it does not mark the fee paid on its own.
class SubmitPaymentClaimPage extends ConsumerStatefulWidget {
  final String feeId;
  final double? outstandingAmount;

  const SubmitPaymentClaimPage({super.key, required this.feeId, this.outstandingAmount});

  @override
  ConsumerState<SubmitPaymentClaimPage> createState() => _SubmitPaymentClaimPageState();
}

class _SubmitPaymentClaimPageState extends ConsumerState<SubmitPaymentClaimPage> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();
  File? _photo;
  DateTime? _claimedDate;
  String? _claimedMode;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.outstandingAmount != null && widget.outstandingAmount! > 0) {
      _amountController.text = widget.outstandingAmount!.toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 80, maxWidth: 1920, maxHeight: 1920);
    if (picked != null) {
      setState(() {
        _photo = File(picked.path);
        _error = null;
      });
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _claimedDate ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
    );
    if (picked != null) {
      setState(() => _claimedDate = picked);
    }
  }

  Future<void> _submit() async {
    if (_photo == null) {
      setState(() => _error = context.l10n.claimAttachProofFirst);
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final fileKey = await ref.read(filesRepositoryProvider).upload(_photo!, category: 'payment_claim_proof');
      final amountText = _amountController.text.trim();
      await ref.read(paymentClaimsRepositoryProvider).submitClaim(
            studentFeeId: widget.feeId,
            fileKey: fileKey,
            claimedAmount: amountText.isEmpty ? null : double.tryParse(amountText),
            claimedDate: _claimedDate,
            claimedMode: _claimedMode,
            note: _noteController.text.trim(),
          );
      // Refresh the Fees screen's claim list and the home Fee card ("claim under review").
      ref.invalidate(myPaymentClaimsProvider);
      ref.invalidate(parentHomeProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.l10n.claimSubmittedToast)),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(() => _error = currentL10n.claimCouldNotSubmit(describeError(e)));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.claimFormTitle)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_error != null) ErrorBanner(message: _error!),
            Text(l.claimFormIntro),
            const SizedBox(height: 16),
            if (_photo != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(_photo!, height: 220, width: double.infinity, fit: BoxFit.cover),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _pickPhoto(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: Text(_photo == null ? l.claimTakePhoto : l.claimRetakePhoto),
                ),
                OutlinedButton.icon(
                  onPressed: () => _pickPhoto(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(l.claimChooseFromGallery),
                ),
              ],
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: l.claimAmountLabel, border: const OutlineInputBorder(), prefixText: '₹'),
            ),
            const SizedBox(height: 16),
            InkWell(
              onTap: _pickDate,
              child: InputDecorator(
                decoration: InputDecoration(labelText: l.claimDateLabel, border: const OutlineInputBorder()),
                child: Text(_claimedDate == null ? l.claimSelectDate : displayDate(_claimedDate!)),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _claimedMode,
              decoration: InputDecoration(labelText: l.claimModeLabel, border: const OutlineInputBorder()),
              items: [
                for (final mode in _paymentModes) DropdownMenuItem(value: mode, child: Text(paymentModeLabel(l, mode))),
              ],
              onChanged: (value) => setState(() => _claimedMode = value),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _noteController,
              minLines: 2,
              maxLines: 4,
              maxLength: 500,
              decoration: InputDecoration(labelText: l.claimNoteLabel, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: l.claimSubmitForReview,
              isLoading: _isSubmitting,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
