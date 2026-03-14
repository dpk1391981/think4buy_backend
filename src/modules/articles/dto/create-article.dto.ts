import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsNumber, IsUrl } from 'class-validator';
import { ArticleStatus, ArticleCategory } from '../entities/article.entity';

export class CreateArticleDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  featuredImage?: string;

  @IsArray()
  @IsOptional()
  gallery?: string[];

  @IsEnum(ArticleCategory)
  @IsOptional()
  category?: ArticleCategory;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsEnum(ArticleStatus)
  @IsOptional()
  status?: ArticleStatus;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsNumber()
  @IsOptional()
  readTime?: number;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  metaKeywords?: string;

  @IsString()
  @IsOptional()
  ogImage?: string;

  @IsString()
  @IsOptional()
  canonicalUrl?: string;
}

export class UpdateArticleDto extends CreateArticleDto {}
