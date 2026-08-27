import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { History } from './database/entities/history.entity';
import { OrderItem } from './database/entities/order-item.entity';
import { Order } from './database/entities/order.entity';
import { PartnerProduct } from './database/entities/partner-product.entity';
import { User } from './database/entities/user.entity';
import { WarehouseItem } from './database/entities/warehouse-item.entity';
import { AdminSalesModule } from './admin-sales/admin-sales.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { AdminInventoryModule } from './admin-inventory/admin-inventory.module';
import { HistorySyncModule } from './history-sync/history-sync.module';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        const useSsl = config.get<string>('DATABASE_SSL', 'false') === 'true';

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          entities: [User, PartnerProduct, History, WarehouseItem, Order, OrderItem],
          synchronize: false,
        };
      },
    }),
    HistorySyncModule,
    OrdersModule,
    AdminSalesModule,
    AuthModule,
    AccountsModule,
    AdminInventoryModule,
  ],
})
export class AppModule {}
