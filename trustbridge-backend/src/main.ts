import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  // Increase body size limit for file uploads
  app.use(require('express').json({ limit: '50mb' }));
  app.use(require('express').urlencoded({ limit: '50mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS configuration
  app.enableCors({
    origin: [
      'https://www.tbafrica.xyz',
      'https://tbafrica.xyz',
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://trust-bridge-africa.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('TrustBridge API')
    .setDescription('Real-World Asset Tokenization Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Assets', 'Asset management endpoints')
    .addTag('Investments', 'Investment management endpoints')
    .addTag('Verification', 'Asset verification endpoints')
    .addTag('Attestors', 'Attestor management endpoints')
    .addTag('Chainlink', 'Chainlink oracle endpoints')
    .addTag('Hedera', 'Hedera blockchain endpoints')
    .addTag('Analytics', 'Analytics and reporting endpoints')
    .addTag('Portfolio', 'Portfolio management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'TrustBridge API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 4001;
  await app.listen(port);

  console.log(`🚀 TrustBridge Server running on http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
  console.log(`💚 Hedera + Chainlink integration: ACTIVE`);
  console.log(`🌍 REST API endpoints: http://localhost:${port}/api`);
  console.log(`🎮 GraphQL playground: http://localhost:${port}/graphql`);
  console.log(`🔌 WebSocket subscriptions: ws://localhost:${port}`);
}

bootstrap();
