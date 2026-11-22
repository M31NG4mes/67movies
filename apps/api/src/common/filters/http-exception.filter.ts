import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Внутренняя ошибка сервера';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as any)?.message || exception.message;
    } else if ((exception as any)?.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'Запись с такими уникальными данными уже существует';
    } else if ((exception as any)?.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Запрашиваемая запись не найдена';
    } else {
      this.logger.error(`Unhandled error on ${req.method} ${req.url}`, (exception as any)?.stack);
    }

    res.status(status).json({
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
