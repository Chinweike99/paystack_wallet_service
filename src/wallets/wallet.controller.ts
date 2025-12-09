import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { DepositDto, depositSchema } from './dto/deposit.dto';
import { TransferDto, transferSchema } from './dto/transfer.dto';
import { Permission } from '../entities/api-key.entity';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PaystackService } from './services/paystack.service';
import { WalletService } from './wallet.service';
import { CompositeAuthGuard } from '../auth/strategy/composite-auth.guard';
import { Permissions } from '../api-key/decorators/permission.decorators';
import { Public } from '../auth/decorators/public.decorator';
import { transactionsQuerySchema, TransactionsQueryDto } from './dto/transaction-query.dto';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private walletService: WalletService,
    private paystackService: PaystackService,
  ) {}

  @Post('deposit')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.DEPOSIT)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ 
    name: 'x-api-key', 
    required: false,
    description: 'API key for service-to-service access' 
  })
  @ApiOperation({ summary: 'Initialize a deposit transaction' })
  @ApiResponse({ status: 200, description: 'Deposit initialized successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deposit(
    @Request() req,
    @Body(new ZodValidationPipe(depositSchema)) depositDto: DepositDto,
  ) {
    return this.walletService.initializeDeposit(
      req.user.id,
      depositDto.amount,
    );
  }

  @Get('balance')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.READ)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  async getBalance(@Request() req) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('transfer')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.TRANSFER)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiOperation({ summary: 'Transfer funds to another wallet' })
  @ApiResponse({ status: 200, description: 'Transfer completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transfer request' })
  async transfer(
    @Request() req,
    @Body(new ZodValidationPipe(transferSchema)) transferDto: TransferDto,
  ) {
    return this.walletService.transferFunds(
      req.user.id,
      transferDto.wallet_number,
      transferDto.amount,
    );
  }

  @Get('transactions')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.READ)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiOperation({ summary: 'Get transaction history' })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['deposit', 'transfer', 'withdrawal'] })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'success', 'failed'] })
  async getTransactions(
    @Request() req,
    @Query(new ZodValidationPipe(transactionsQuerySchema)) query: TransactionsQueryDto,
  ) {
    return this.walletService.getTransactionHistory(
      req.user.id,
      {
        limit: query.limit as any,
        page: query.page as any,
        type: query.type as any,
        status: query.status as any,
      },
    );
  }

  @Get('details')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.READ)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiOperation({ summary: 'Get wallet details with recent transactions' })
  async getWalletDetails(@Request() req) {
    return this.walletService.getWalletDetails(req.user.id);
  }

  @Get('deposit/:reference/status')
  @UseGuards(CompositeAuthGuard)
  @Permissions(Permission.READ)
  @ApiBearerAuth('JWT-auth')
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiOperation({ summary: 'Check deposit status' })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getDepositStatus(
    @Request() req,
    @Param('reference') reference: string,
  ) {
    return this.walletService.verifyDepositStatus(reference, req.user.id);
  }

  @Post('paystack/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = this.paystackService.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    await this.walletService.handleWebhookEvent(payload);
    return { status: true };
  }
}