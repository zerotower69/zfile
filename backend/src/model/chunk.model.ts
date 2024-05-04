import { AutoIncrement, Column, Model, Table, Comment, AllowNull, PrimaryKey } from 'sequelize-typescript';
import { DataTypes } from 'sequelize';

@Table({
  tableName: 'chunk_list',
})
export class ChunkModel extends Model {
  @Comment('chunkId')
  @AllowNull(false)
  @AutoIncrement
  @PrimaryKey
  @Column(DataTypes.INTEGER)
  id: number;

  @Comment('文件唯一的hash值')
  @Column(DataTypes.STRING)
  file_hash: string;

  @Comment('分片序号')
  @Column(DataTypes.INTEGER)
  chunk_number: number;

  @Comment('分片hash')
  @Column(DataTypes.STRING)
  chunk_hash: string;

  @Comment('分片大小')
  @Column(DataTypes.INTEGER)
  chunk_size: number;

  @Comment('文件名称')
  @Column(DataTypes.STRING)
  file_name: string;

  @Comment('分片总数')
  @Column(DataTypes.INTEGER)
  chunk_total: number;

  @Comment('文件大小')
  @Column(DataTypes.INTEGER)
  total_size: number;
}
