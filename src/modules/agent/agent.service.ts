import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property, PropertyStatus, ApprovalStatus } from '../properties/entities/property.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { WalletService } from '../wallet/wallet.service';
import { AgencyService } from '../agency/agency.service';

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(Property)
    private propertyRepo: Repository<Property>,
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    private walletService: WalletService,
    private agencyService: AgencyService,
  ) {}

  async getDashboardStats(userId: string) {
    const [
      totalListings,
      activeListings,
      pendingListings,
      totalInquiries,
      recentInquiries,
      recentListings,
      wallet,
      agencyDashboard,
    ] = await Promise.all([
      this.propertyRepo.count({ where: { ownerId: userId } }),
      this.propertyRepo.count({
        where: { ownerId: userId, status: PropertyStatus.ACTIVE, approvalStatus: ApprovalStatus.APPROVED },
      }),
      this.propertyRepo.count({
        where: { ownerId: userId, approvalStatus: ApprovalStatus.PENDING },
      }),
      this.inquiryRepo
        .createQueryBuilder('inquiry')
        .innerJoin('inquiry.property', 'property')
        .where('property.ownerId = :userId', { userId })
        .getCount(),
      this.inquiryRepo
        .createQueryBuilder('inquiry')
        .innerJoin('inquiry.property', 'property')
        .where('property.ownerId = :userId', { userId })
        .leftJoinAndSelect('inquiry.property', 'prop')
        .orderBy('inquiry.createdAt', 'DESC')
        .take(5)
        .getMany(),
      this.propertyRepo.find({
        where: { ownerId: userId },
        relations: ['images'],
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.walletService.getWallet(userId),
      this.agencyService.getAgentDashboard(userId).catch(() => null),
    ]);

    return {
      totalListings,
      activeListings,
      pendingListings,
      totalInquiries,
      walletBalance: wallet.balance,
      recentInquiries,
      recentListings,
      // Agency-related data
      agentProfile: agencyDashboard?.profile ?? null,
      agency: agencyDashboard?.agency ?? null,
      assignedListings: agencyDashboard?.totalListings ?? 0,
      adminAssignedProperties: agencyDashboard?.adminAssignedCount ?? 0,
      rating: agencyDashboard?.rating ?? 0,
      totalDeals: agencyDashboard?.totalDeals ?? 0,
      locations: agencyDashboard?.locations ?? [],
    };
  }
}
