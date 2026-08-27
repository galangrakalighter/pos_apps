import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminInventoryController, AdminWarehouseController, PartnerProductsController, WarehouseCatalogController, WarehouseImagesController } from './admin-inventory.controller';
import { AdminInventoryService } from './admin-inventory.service';

@Module({ imports: [AuthModule], controllers: [AdminInventoryController, WarehouseCatalogController, AdminWarehouseController, WarehouseImagesController, PartnerProductsController], providers: [AdminInventoryService] })
export class AdminInventoryModule {}
