import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../modules/auth/auth.module';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [MetricsService, RolesGuard],
  exports: [MetricsService],
})
export class MonitoringModule {}
