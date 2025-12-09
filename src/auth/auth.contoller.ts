import {
  Controller,
  Get,
  Req,
  UseGuards,
  Res,
  HttpStatus,
  Post,
  Body,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import type { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google' })
  async googleAuth() {
    // Authentication handled by Google Strategy
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    try {
      const user = await this.authService.validateOrCreateUser(req.user);
      const result = await this.authService.login(user);

      // Redirect to frontend with token in query parameter
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(
        `${frontendUrl}/auth/callback?token=${result.access_token}&user=${encodeURIComponent(JSON.stringify(result.user))}`,
      );
    } catch (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refreshToken(@Body() body: { token: string }) {
    try {
      const decoded = this.authService['jwtService'].verify(body.token, {
        ignoreExpiration: true,
      });
      const user = await this.authService.validateUser(decoded);
      return this.authService.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid' })
  async validateToken(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = this.authService['jwtService'].verify(token);
      const user = await this.authService.validateUser(decoded);
      return { valid: true, user };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}