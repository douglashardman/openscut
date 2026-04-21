import { PROTOCOL_VERSION } from '@openscut/core';

export function bootstrap(): void {
  console.log(`scut-relay scaffolding. Protocol v${PROTOCOL_VERSION}.`);
}

bootstrap();
