import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message || 'Internal server error';

    // Handle Multer LIMIT_FILE_SIZE cleanly as 400 Bad Request
    if ((exception as any)?.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.BAD_REQUEST;
      message = {
        statusCode: 400,
        message: 'File size exceeds maximum allowed limit of 5 MB.',
        error: 'Bad Request',
      };
    }

    this.logger.error(
      `[${request.method}] ${request.url} >> Status: ${status} >> Error: ${JSON.stringify(
        message,
      )}`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: typeof message === 'object' ? message : { message },
    });
  }
}
