import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  AddCopiesDto,
  BookInputDto,
  BooksQueryDto,
  BorrowerQueryDto,
  CopyStatusDto,
  CreateBookDto,
  FineActionDto,
  IssueDto,
  LibrarySettingsDto,
  LoansQueryDto,
  ReturnDto,
} from './dto/library.dto';
import { LibraryService } from './library.service';

const DESK = [Role.librarian, Role.admin, Role.super_admin] as const;

/** Library (flag `library`, Premium Max). */
@Controller('library')
@UseGuards(FeatureGuard('library'))
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('summary')
  @Roles(...DESK)
  summary(@TenantId() tenantId: string) {
    return this.library.summary(tenantId);
  }

  @Get('settings')
  @Roles(...DESK)
  settings(@TenantId() tenantId: string) {
    return this.library.settings(tenantId);
  }

  @Put('settings')
  @Roles(...DESK)
  saveSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: LibrarySettingsDto,
  ) {
    return this.library.saveSettings(tenantId, user.id, dto);
  }

  @Get('books')
  @Roles(...DESK)
  books(@TenantId() tenantId: string, @Query() q: BooksQueryDto) {
    return this.library.books(tenantId, q);
  }

  @Post('books')
  @Roles(...DESK)
  createBook(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateBookDto,
  ) {
    return this.library.createBook(tenantId, user.id, dto);
  }

  @Patch('books/:id')
  @Roles(...DESK)
  updateBook(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookInputDto,
  ) {
    return this.library.updateBook(tenantId, user.id, id, dto);
  }

  @Delete('books/:id')
  @Roles(...DESK)
  deleteBook(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.deleteBook(tenantId, user.id, id);
  }

  @Post('books/:id/copies')
  @Roles(...DESK)
  addCopies(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCopiesDto,
  ) {
    return this.library.addCopies(tenantId, user.id, id, dto);
  }

  @Patch('copies/:id')
  @Roles(...DESK)
  copyStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CopyStatusDto,
  ) {
    return this.library.setCopyStatus(tenantId, user.id, id, dto.status);
  }

  /** Desk lookup by the number on the book's label. */
  @Get('copies/by-accession/:accessionNo')
  @Roles(...DESK)
  copy(
    @TenantId() tenantId: string,
    @Param('accessionNo') accessionNo: string,
  ) {
    return this.library.copy(tenantId, accessionNo);
  }

  @Get('borrowers')
  @Roles(...DESK)
  borrowers(@TenantId() tenantId: string, @Query() q: BorrowerQueryDto) {
    return this.library.borrowers(tenantId, q.search);
  }

  @Get('borrowers/:kind/:id')
  @Roles(...DESK)
  borrowerLoans(
    @TenantId() tenantId: string,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.borrowerLoans(
      tenantId,
      kind === 'staff' ? 'staff' : 'student',
      id,
    );
  }

  @Post('issue')
  @Roles(...DESK)
  issue(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: IssueDto,
  ) {
    return this.library.issue(tenantId, user.id, dto);
  }

  @Post('return')
  @Roles(...DESK)
  @HttpCode(HttpStatus.OK)
  returnCopy(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: ReturnDto,
  ) {
    return this.library.returnCopy(tenantId, user.id, dto.accessionNo);
  }

  @Get('loans')
  @Roles(...DESK)
  loans(@TenantId() tenantId: string, @Query() q: LoansQueryDto) {
    return this.library.loans(tenantId, q);
  }

  @Post('loans/:id/renew')
  @Roles(...DESK)
  @HttpCode(HttpStatus.OK)
  renew(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.renew(tenantId, user.id, id);
  }

  @Post('loans/:id/fine')
  @Roles(...DESK)
  @HttpCode(HttpStatus.OK)
  fine(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FineActionDto,
  ) {
    return this.library.settleFine(tenantId, user.id, id, dto.action);
  }

  /** The parent's own child's borrowed books. */
  @Get('child/:studentId')
  @Roles(Role.parent)
  child(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.library.child(tenantId, user.id, studentId);
  }
}
