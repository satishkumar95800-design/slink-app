import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PhotoAlbumsController } from './photo-albums.controller';
import { PhotoAlbumsService } from './photo-albums.service';

/** Activity photo albums for parents (Premium Max, flag photoAlbums). */
@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [PhotoAlbumsController],
  providers: [PhotoAlbumsService],
})
export class PhotoAlbumsModule {}
