/**
 * Layer: Backend Controller
 * Responsibility: Exposes lightweight root endpoints used for service reachability and basic application diagnostics.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

