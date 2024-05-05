import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectModel } from '@nestjs/sequelize';
import { ChunkModel } from './model/chunk.model';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import * as fs from 'node:fs';
import { FileModel } from './model/file.model';
import { Op } from 'sequelize';

function sleep(timeout: number) {
  // @ts-ignore
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve(void 0);
    }, timeout);
  });
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectModel(ChunkModel)
    private chunkModel: typeof ChunkModel,
    @InjectModel(FileModel)
    private fileModel: typeof FileModel,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  //上传单文件
  @Post('/upload')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      dest: 'uploads/chunks',
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: Record<string, any>) {
    const { total, chunkNumber, chunkSize, fileName, fileSize, fileHash, chunkHash } = body;
    //检查切片是否已经存在
    Op.and;
    const foundChunk = await this.chunkModel.findOne({
      where: {
        [Op.and]: [{ chunk_hash: chunkHash }, { chunk_number: chunkNumber }, { file_hash: fileHash }],
      },
    });
    if (foundChunk) {
      return {
        success: true,
        data: null,
      };
    }
    //指定hash文件路径
    const hashChunkPath = this.appService.getChunkPath(fileHash);
    //如果路径不存在则创建路径
    if (!fs.existsSync(hashChunkPath)) {
      await fs.promises.mkdir(hashChunkPath);
    }
    //移动文件到指定的目录
    const chunkPath = fileHash + '_' + chunkNumber;
    await fs.promises.cp(file.path, hashChunkPath + '/' + chunkPath);
    //@ts-ignore
    await Promise.allSettled([fs.promises.rm(file.path), fs.promises.rm(`uploads/${chunkHash}`)]);
    const result = await this.chunkModel.create({
      file_hash: fileHash,
      chunk_number: parseInt(chunkNumber),
      chunk_size: parseInt(chunkSize),
      chunk_total: parseInt(total),
      chunk_hash: chunkHash,
      file_name: fileName,
      total_size: parseInt(fileSize),
    });
    if (result) {
      return {
        success: true,
        data: null,
      };
    } else {
      throw new HttpException('插入失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  //检查文件是否已经上传，返回已经上传的切片
  @Post('check')
  @HttpCode(200)
  async checkChunks(@Body() body: { fileHash: string }) {
    const { fileHash } = body;
    //先看看文件存在吗
    const foundFile = await this.fileModel.findOne({
      where: {
        file_hash: fileHash,
      },
    });
    if (foundFile) {
      return {
        success: true,
        data: null,
      };
    }
    const list = await this.chunkModel.findAll({
      where: {
        file_hash: fileHash,
      },
    });
    return {
      success: false,
      data: list,
    };
  }

  //合并文件
  @Post('merge')
  @HttpCode(200)
  async mergeFile(@Body() body: { total: number; md5: string; fileName: string }) {
    const { total, md5, fileName } = body;
    //先检查文件是否已经上传
    const foundFile = await this.fileModel.findOne({
      where: {
        file_hash: md5,
      },
    });
    if (foundFile) {
      return {
        success: true,
        data: foundFile.file_path,
      };
    }
    try {
      //分片存储的文件夹路径
      const chunkPath = this.appService.getChunkPath(md5);
      //创建合并后文件的文件路径
      const filePath = 'uploads/files/' + fileName;
      //读取对应hash文件夹下的所有分片文件的名称
      const chunkList: string[] = fs.existsSync(chunkPath) ? fs.readdirSync(chunkPath) : [];
      if (chunkList.length === 0) {
        //分片为空，提前返回
        return {
          success: false,
          message: '分片不存在或文件未上传',
        };
      }
      //分片排序
      chunkList.sort((a: string, b: string) => {
        const indexA = parseInt(a.split('_').pop());
        const indexB = parseInt(b.split('_').pop());
        return indexA - indexB;
      });
      if (chunkList.length !== total) {
        throw new HttpException('分片缺失', HttpStatus.INTERNAL_SERVER_ERROR);
      } else {
        if (!fs.existsSync('uploads/files')) {
          fs.mkdirSync('uploads/files');
        }
        await fs.promises.writeFile(filePath, '');
        for (let i = 0; i < chunkList.length; i++) {
          const chunkName = `${chunkPath}/${chunkList[i]}`;
          const chunk = await fs.promises.readFile(chunkName);
          await fs.promises.appendFile(filePath, chunk);
        }
        //将文件信息记录
        const file = await this.fileModel.create({
          file_hash: md5,
          file_name: fileName,
          file_path: filePath,
        });
        const chunkModelList = await this.chunkModel.findAll({
          where: {
            file_hash: md5,
          },
        });
        const removePs = [];
        for (let i = 0; i < chunkModelList.length; i++) {
          const p = fs.promises.rm(`uploads/chunks/${chunkModelList[i].chunk_hash}`);
          removePs.push(p);
        }
        // @ts-ignore
        await Promise.allSettled(removePs);
        //还要去删除chunk-list中的记录
        const effect = await this.chunkModel.destroy({
          where: {
            file_hash: md5,
          },
        });
        //表信息创建了，chunk-list也清了，递归删除
        await fs.promises.rm(chunkPath, {
          recursive: true,
        });
        return {
          success: true,
          data: file.file_path,
        };
      }
    } catch (e) {
      throw new HttpException(e?.message ?? e, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
