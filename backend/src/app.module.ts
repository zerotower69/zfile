import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChunkModel } from './model/chunk.model';
import { FileModel } from './model/file.model';
import { ConfigModule } from '@nestjs/config';
import { getConfig } from './config';

const config = getConfig();

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: false, // 忽视默认读取.env的文件配置
      isGlobal: true, // 全局注入
      load: [getConfig], // 加载配置文件
    }),
    SequelizeModule.forRoot({
      host: config.mysql.host,
      port: config.mysql.port,
      timezone: config.mysql.timezone,
      database: config.mysql.database,
      username: config.mysql.username,
      password: config.mysql.password,
      autoLoadModels: config.mysql.autoLoadModels,
      sync: {
        alter: config.mysql.synchronize,
      },
      logging: config.mysql.logging,
      dialect: config.mysql.dialect,
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
