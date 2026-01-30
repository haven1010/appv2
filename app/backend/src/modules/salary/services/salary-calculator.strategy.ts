
import { PayType } from '../../base/entities/recruitment-job.entity';

export interface SalaryCalculationInput {
  unitPrice: number;
  workDuration?: number; // Hours
  pieceCount?: number;   // Items count
}

export interface SalaryStrategy {
  calculate(input: SalaryCalculationInput): number;
}

export class FixedSalaryStrategy implements SalaryStrategy {
  calculate(input: SalaryCalculationInput): number {
    // Fixed daily wage, regardless of duration (unless partial day logic added later)
    return Number(input.unitPrice);
  }
}

export class HourlySalaryStrategy implements SalaryStrategy {
  calculate(input: SalaryCalculationInput): number {
    return Number(input.unitPrice) * (Number(input.workDuration) || 0);
  }
}

export class PieceworkSalaryStrategy implements SalaryStrategy {
  calculate(input: SalaryCalculationInput): number {
    return Number(input.unitPrice) * (Number(input.pieceCount) || 0);
  }
}

export class SalaryCalculatorFactory {
  static getStrategy(type: PayType): SalaryStrategy {
    switch (type) {
      case PayType.FIXED:
        return new FixedSalaryStrategy();
      case PayType.HOURLY:
        return new HourlySalaryStrategy();
      case PayType.PIECEWORK:
        return new PieceworkSalaryStrategy();
      default:
        throw new Error(`Unknown PayType: ${type}`);
    }
  }
}
