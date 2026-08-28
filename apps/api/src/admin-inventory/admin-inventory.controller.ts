import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminInventoryService } from './admin-inventory.service';
import { CreateWarehouseProductDto } from './dto/create-warehouse-product.dto';
import { UpdateWarehouseProductDto } from './dto/update-warehouse-product.dto';
import { UpdatePartnerProductPriceDto } from './dto/update-partner-product-price.dto';
import { CreateFinishedProductDto } from './dto/create-finished-product.dto';
import { UpdateFinishedProductDto } from './dto/update-finished-product.dto';
import { UpdateOwnFinishedProductDto } from './dto/update-own-finished-product.dto';

@Controller('admin/partners')
@UseGuards(JwtAuthGuard)
export class AdminInventoryController {
  constructor(private readonly service: AdminInventoryService) {}

  @Get()
  partners(@CurrentUser() admin: AuthenticatedUser) { return this.service.partners(admin); }

  @Get(':mitraId/stock')
  stock(@CurrentUser() admin: AuthenticatedUser, @Param('mitraId', ParseUUIDPipe) mitraId: string) {
    return this.service.partnerStock(admin, mitraId);
  }

  @Post(':mitraId/finished-products')
  createFinished(@CurrentUser() admin: AuthenticatedUser, @Param('mitraId', ParseUUIDPipe) mitraId: string, @Body() dto: CreateFinishedProductDto) {
    return this.service.createFinishedProduct(admin, mitraId, dto);
  }

  @Patch(':mitraId/finished-products/:productId')
  updateFinished(@CurrentUser() admin: AuthenticatedUser, @Param('mitraId', ParseUUIDPipe) mitraId: string, @Param('productId', ParseIntPipe) productId: number, @Body() dto: UpdateFinishedProductDto) {
    return this.service.updateFinishedProduct(admin, mitraId, String(productId), dto);
  }

  @Delete(':mitraId/finished-products/:productId')
  deleteFinished(@CurrentUser() admin: AuthenticatedUser, @Param('mitraId', ParseUUIDPipe) mitraId: string, @Param('productId', ParseIntPipe) productId: number) {
    return this.service.deleteFinishedProduct(admin, mitraId, String(productId));
  }
}

@Controller('warehouse')
@UseGuards(JwtAuthGuard)
export class WarehouseCatalogController {
  constructor(private readonly service: AdminInventoryService) {}

  @Get()
  catalog() { return this.service.warehouseCatalog(); }
}

@Controller('admin/warehouse')
@UseGuards(JwtAuthGuard)
export class AdminWarehouseController {
  constructor(private readonly service: AdminInventoryService) {}

  @Get()
  catalog(@CurrentUser() admin: AuthenticatedUser) {
    return this.service.adminWarehouseCatalog(admin);
  }

  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateWarehouseProductDto) {
    return this.service.createWarehouseProduct(admin, dto);
  }

  @Patch(':id')
  update(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWarehouseProductDto) {
    return this.service.updateWarehouseProduct(admin, String(id), dto);
  }

  @Delete(':id')
  remove(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteWarehouseProduct(admin, String(id));
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  image(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string }) {
    return this.service.saveWarehouseImage(admin, String(id), file);
  }
}

@Controller('warehouse/images')
export class WarehouseImagesController {
  constructor(private readonly service: AdminInventoryService) {}
  @Get(':filename') image(@Param('filename') filename: string) { return this.service.productImage(filename); }
}

@Controller('products')
@UseGuards(JwtAuthGuard)
export class PartnerProductsController {
  constructor(private readonly service: AdminInventoryService) {}
  @Get('mine') mine(@CurrentUser() user: AuthenticatedUser) { return this.service.myProducts(user); }
  @Patch(':id/price') price(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePartnerProductPriceDto) { return this.service.updateMyProductPrice(user, String(id), dto.price); }
  @Patch(':id/finished-stock') finishedStock(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOwnFinishedProductDto) { return this.service.updateMyFinishedProduct(user, String(id), dto); }
}
