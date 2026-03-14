import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Article, ArticleStatus } from './entities/article.entity';
import { CreateArticleDto, UpdateArticleDto } from './dto/create-article.dto';

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-');
}

function estimateReadTime(content: string): number {
  const words = content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────

  async findPublished(params: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    featured?: boolean;
  }) {
    const { page = 1, limit = 12, category, search, featured } = params;
    const qb = this.articleRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.author', 'author')
      .where('a.status = :status', { status: ArticleStatus.PUBLISHED })
      .orderBy('a.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (category) qb.andWhere('a.category = :category', { category });
    if (search)   qb.andWhere('(a.title LIKE :q OR a.excerpt LIKE :q)', { q: `%${search}%` });
    if (featured) qb.andWhere('a.isFeatured = :f', { f: true });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.articleRepo.findOne({
      where: { slug, status: ArticleStatus.PUBLISHED },
      relations: ['author'],
    });
    if (!article) throw new NotFoundException('Article not found');
    // Increment view count (fire-and-forget)
    this.articleRepo.increment({ id: article.id }, 'viewCount', 1).catch(() => {});
    return article;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async adminFindAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, category, search } = params;
    const qb = this.articleRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.author', 'author')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status)   qb.andWhere('a.status = :status', { status });
    if (category) qb.andWhere('a.category = :category', { category });
    if (search)   qb.andWhere('(a.title LIKE :q OR a.slug LIKE :q)', { q: `%${search}%` });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adminFindOne(id: string): Promise<Article> {
    const article = await this.articleRepo.findOne({ where: { id }, relations: ['author'] });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async create(dto: CreateArticleDto, authorId: string): Promise<Article> {
    const slug = dto.slug ? toSlug(dto.slug) : toSlug(dto.title);

    const existing = await this.articleRepo.findOne({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already exists`);

    const readTime = dto.readTime ?? estimateReadTime(dto.content);
    const publishedAt = dto.status === ArticleStatus.PUBLISHED ? new Date() : null;

    const article = this.articleRepo.create({
      ...dto,
      slug,
      authorId,
      readTime,
      publishedAt,
    });

    return this.articleRepo.save(article);
  }

  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.adminFindOne(id);

    if (dto.slug && dto.slug !== article.slug) {
      const newSlug = toSlug(dto.slug);
      const conflict = await this.articleRepo.findOne({ where: { slug: newSlug } });
      if (conflict && conflict.id !== id) throw new ConflictException(`Slug "${newSlug}" already exists`);
      dto.slug = newSlug;
    }

    // Set publishedAt when first publishing
    if (dto.status === ArticleStatus.PUBLISHED && article.status !== ArticleStatus.PUBLISHED) {
      (dto as any).publishedAt = new Date();
    }

    if (dto.content && !dto.readTime) {
      (dto as any).readTime = estimateReadTime(dto.content);
    }

    Object.assign(article, dto);
    return this.articleRepo.save(article);
  }

  async delete(id: string): Promise<void> {
    const article = await this.adminFindOne(id);
    await this.articleRepo.remove(article);
  }
}
