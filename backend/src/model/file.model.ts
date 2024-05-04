import { AllowNull, AutoIncrement, Column, Comment, Model, PrimaryKey, Table } from 'sequelize-typescript';
import { DataTypes } from 'sequelize';

@Table({
  tableName: 'file_list',
})
export class FileModel extends Model {
  @Comment('文件id')
  @AllowNull(false)
  @AutoIncrement
  @PrimaryKey
  @Column(DataTypes.INTEGER)
  id: number;

  @Comment('文件唯一的hash值')
  @Column(DataTypes.STRING)
  file_hash: string;

  @Comment('文件大小')
  @Column(DataTypes.INTEGER)
  file_size: number;

  @Comment('文件名')
  @Column(DataTypes.STRING)
  file_name: string;

  @Comment('文件路径')
  @Column(DataTypes.STRING)
  file_path: string;
}
