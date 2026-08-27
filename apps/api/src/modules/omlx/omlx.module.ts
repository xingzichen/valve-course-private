import { Global, Module } from '@nestjs/common';

import { OmlxService } from './omlx.service';

@Global()
@Module({ providers: [OmlxService], exports: [OmlxService] })
export class OmlxModule {}
