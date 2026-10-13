import { Module } from '@nestjs/common';
import { TransferCertificatesService } from './transfer-certificates.service';
import { TransferCertificatesController } from './transfer-certificates.controller';

@Module({
  providers: [TransferCertificatesService],
  controllers: [TransferCertificatesController],
})
export class TransferCertificatesModule {}
