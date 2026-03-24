import {
  Controller, Get, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ToolsService } from './tools.service';

@ApiTags('Tools & Insights')
@Controller()
export class ToolsController {
  constructor(private readonly svc: ToolsService) {}

  // ── GET /api/v1/tools/emi ───────────────────────────────────────────────────
  @Get('tools/emi')
  @ApiOperation({ summary: 'EMI calculator: monthly payment, total interest, amortisation schedule' })
  @ApiQuery({ name: 'principal', type: Number, description: 'Loan amount in ₹' })
  @ApiQuery({ name: 'rate',      type: Number, description: 'Annual interest rate (%)' })
  @ApiQuery({ name: 'tenure',    type: Number, description: 'Loan tenure in months' })
  emi(
    @Query('principal') principal: string,
    @Query('rate')      rate:      string,
    @Query('tenure')    tenure:    string,
  ) {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const t = parseInt(tenure, 10);
    if (!p || !r || !t || p <= 0 || r <= 0 || t <= 0) {
      throw new BadRequestException('principal, rate and tenure must be positive numbers');
    }
    if (t > 360) throw new BadRequestException('Tenure cannot exceed 360 months (30 years)');
    return { success: true, data: this.svc.calcEmi(p, r, t) };
  }

  // ── GET /api/v1/tools/price-calc ─────────────────────────────────────────────
  @Get('tools/price-calc')
  @ApiOperation({ summary: 'Property price breakdown: base, stamp duty, registration, GST' })
  @ApiQuery({ name: 'area',         type: Number, description: 'Area in sq.ft' })
  @ApiQuery({ name: 'pricePerSqft', type: Number, description: 'Price per sq.ft in ₹' })
  priceCalc(
    @Query('area')         area:         string,
    @Query('pricePerSqft') pricePerSqft: string,
  ) {
    const a = parseFloat(area);
    const p = parseFloat(pricePerSqft);
    if (!a || !p || a <= 0 || p <= 0) {
      throw new BadRequestException('area and pricePerSqft must be positive numbers');
    }
    return { success: true, data: this.svc.calcPriceBreakdown(a, p) };
  }

  // ── GET /api/v1/tools/roi ───────────────────────────────────────────────────
  @Get('tools/roi')
  @ApiOperation({ summary: 'ROI / Investment returns: rental yield and projected returns' })
  @ApiQuery({ name: 'price',        type: Number, description: 'Property price in ₹' })
  @ApiQuery({ name: 'rent',         type: Number, description: 'Monthly rent in ₹' })
  @ApiQuery({ name: 'appreciation', type: Number, description: 'Annual appreciation rate (%)' })
  @ApiQuery({ name: 'years',        required: false, description: 'Comma-separated years e.g. 3,5,10' })
  roi(
    @Query('price')        price:        string,
    @Query('rent')         rent:         string,
    @Query('appreciation') appreciation: string,
    @Query('years')        years?:       string,
  ) {
    const p    = parseFloat(price);
    const r    = parseFloat(rent);
    const a    = parseFloat(appreciation);
    const yrs  = (years ?? '3,5,10').split(',').map(Number).filter(y => y > 0 && y <= 30);
    if (!p || !r || !a || p <= 0 || r <= 0) {
      throw new BadRequestException('price, rent, and appreciation must be positive numbers');
    }
    return { success: true, data: this.svc.calcRoi(p, r, a, yrs.length ? yrs : [3, 5, 10]) };
  }

  // ── GET /api/v1/tools/area-convert ───────────────────────────────────────────
  @Get('tools/area-convert')
  @ApiOperation({ summary: 'Area unit converter: sqft, sqm, sqyard, acre, hectare, gaj, marla, kanal, bigha' })
  @ApiQuery({ name: 'value', type: Number })
  @ApiQuery({ name: 'from',  description: 'Source unit (sqft|sqm|sqyard|acre|hectare|gaj|marla|kanal|bigha)' })
  @ApiQuery({ name: 'to',    description: 'Target unit' })
  areaConvert(
    @Query('value') value: string,
    @Query('from')  from:  string,
    @Query('to')    to:    string,
  ) {
    const v = parseFloat(value);
    if (!v || v <= 0) throw new BadRequestException('value must be a positive number');
    return { success: true, data: this.svc.convertArea(v, from, to) };
  }

  // ── GET /api/v1/tools/predict ─────────────────────────────────────────────
  @Get('tools/predict')
  @ApiOperation({ summary: 'Price prediction: estimated range based on city, type, BHK, and area' })
  @ApiQuery({ name: 'city',         description: 'City name' })
  @ApiQuery({ name: 'propertyType', required: false, description: 'apartment|villa|plot|commercial' })
  @ApiQuery({ name: 'bhk',         required: false, type: Number })
  @ApiQuery({ name: 'area',         type: Number, description: 'Area in sq.ft' })
  async predict(
    @Query('city')         city:          string,
    @Query('propertyType') propertyType?: string,
    @Query('bhk')          bhk?:          string,
    @Query('area')         area?:         string,
  ) {
    if (!city) throw new BadRequestException('city is required');
    const bhkNum  = bhk  ? parseInt(bhk, 10) : 2;
    const areaNum = area ? parseFloat(area)  : 1000;
    const data = await this.svc.predictPrice(city, propertyType ?? 'apartment', bhkNum, areaNum);
    return { success: true, data };
  }

  // ── GET /api/v1/insights/price-trends ─────────────────────────────────────
  @Get('insights/price-trends')
  @ApiOperation({ summary: 'Price trends for a city: monthly PSF trend, locality breakdown, YoY growth' })
  @ApiQuery({ name: 'city',         description: 'City name (required)' })
  @ApiQuery({ name: 'propertyType', required: false })
  @ApiQuery({ name: 'listingType',  required: false, description: 'sale|rent' })
  async priceTrends(
    @Query('city')         city:          string,
    @Query('propertyType') propertyType?: string,
    @Query('listingType')  listingType?:  string,
  ) {
    if (!city) throw new BadRequestException('city is required');
    const data = await this.svc.getPriceTrends(city, propertyType, listingType);
    return { success: true, data };
  }

  // ── GET /api/v1/insights/demand ───────────────────────────────────────────
  @Get('insights/demand')
  @ApiOperation({ summary: 'Demand insights: most searched locations, popular BHK, top cities' })
  @ApiQuery({ name: 'city', required: false })
  async demand(@Query('city') city?: string) {
    const data = await this.svc.getDemandInsights(city);
    return { success: true, data };
  }

  // ── GET /api/v1/insights/market-cards ─────────────────────────────────────
  @Get('insights/market-cards')
  @ApiOperation({ summary: 'Market insight cards derived from real listing data and analytics' })
  @ApiQuery({ name: 'city',  required: false })
  @ApiQuery({ name: 'state', required: false })
  async marketCards(
    @Query('city')  city?:  string,
    @Query('state') state?: string,
  ) {
    const data = await this.svc.getMarketCards(city, state);
    return { success: true, data };
  }

  // ── GET /api/v1/insights/cities ───────────────────────────────────────────
  @Get('insights/cities')
  @ApiOperation({ summary: 'List of cities with available market data' })
  async cities() {
    const data = await this.svc.getAvailableCities();
    return { success: true, data };
  }
}
