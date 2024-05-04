import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ChunkModel } from './model/chunk.model';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getChunkPath(hash: string) {
    return `uploads/chunks/${hash}`;
  }
}
