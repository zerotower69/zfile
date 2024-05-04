import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChunkModel } from './model/chunk.model';
import { FileModel } from './model/file.model';

@Module({
  imports: [
    SequelizeModule.forRoot({
      host: 'localhost',
      port: 3306,
      timezone: '+08:00',
      database: 'upload_file',
      username: 'root',
      password: '12345678',
      autoLoadModels: true,
      sync: {
        alter: true,
      },
      logging: false,
      dialect: 'mysql',
      // pool:{
      //   idle:0,
      //   min:1,
      //   max:100
      // }
      models: [ChunkModel, FileModel],
    }),
    SequelizeModule.forFeature([ChunkModel, FileModel]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
