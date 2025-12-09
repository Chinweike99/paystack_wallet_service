import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const depositSchema = z.object({
  amount: z.number().positive().min(100).max(10000000), // Min 1 NGN, Max 100,000 NGN
});

export class DepositDto {
  @ApiProperty({ 
    example: 5000, 
    description: 'Amount to deposit (in kobo for Paystack, but we handle conversion)',
    minimum: 100,
    maximum: 10000000
  })
  amount: number;
}