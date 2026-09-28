import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

/** Registers a document already uploaded via POST /files/upload (category=general_document). */
export class CreateAccountantDocumentDto {
  @IsString()
  fileKey: string;

  @IsUUID()
  categoryId: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
