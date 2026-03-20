import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { PropType } from './prop-type.entity';

export enum FieldType {
  TEXT      = 'text',
  NUMBER    = 'number',
  DROPDOWN  = 'dropdown',
  CHECKBOX  = 'checkbox',
  RADIO     = 'radio',
  TEXTAREA  = 'textarea',
  DEPENDENT = 'dependent',  // repeatable [select + number] rows
}

@Entity('prop_type_fields')
export class PropTypeField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'propTypeId', length: 36 })
  propTypeId: string;

  @ManyToOne(() => PropType, (t) => t.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propTypeId' })
  propType: PropType;

  @Column({ length: 100 })
  fieldName: string;   // machine key, e.g. "carpet_area"

  @Column({ length: 200 })
  fieldLabel: string;  // display label, e.g. "Carpet Area"

  @Column({ type: 'enum', enum: FieldType, default: FieldType.TEXT })
  fieldType: FieldType;

  @Column({ type: 'json', nullable: true })
  optionsJson: string[] | null; // for dropdown / radio / checkbox

  @Column({ length: 500, nullable: true })
  placeholder: string;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
