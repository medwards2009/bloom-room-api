import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  // Re-export so modules that import UserModule (e.g. AuthModule) can inject the
  // User repository.
  exports: [TypeOrmModule],
})
export class UserModule {}
